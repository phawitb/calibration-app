import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getUnitVariants } from '@/lib/unitVariants'
import { resolveHospitalScope } from '@/lib/hospitalScope'
import { displayHospitalName, normalizeHospitalUnitFromRefs, type UnitRefLike } from '@/lib/hospitalUnit'
import { getIsoMethod } from '@/lib/isoMethods'
import { projectLatestStandards } from '@/lib/standardYearService'
import { buildWorkbook, stampedFileName, xlsxResponse, type ExcelColumn } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 20_000

const TOR_REPORT_TYPES = ['unit', 'yearly', 'savings', 'savings-yearly', 'standards'] as const
type TorReportType = typeof TOR_REPORT_TYPES[number]

const REPORT_META: Record<TorReportType, { code: string; title: string }> = {
  unit: { code: '1.3.2.1.1', title: 'รายงานผลสำหรับหน่วยรับบริการ' },
  yearly: { code: '1.3.2.2.1', title: 'รายงานผลการสอบเทียบเครื่องมือแพทย์รวม' },
  savings: { code: '1.3.2.2.2', title: 'รายงานการลดค่าใช้จ่าย' },
  'savings-yearly': { code: '1.3.2.2.3', title: 'รายงานการลดค่าใช้จ่ายรายปี' },
  standards: { code: '1.3.2.2.4', title: 'รายงานเครื่องมือสอบเทียบประจำห้องปฏิบัติการ' },
}

type Column = { key: string; header: string; align?: 'left' | 'right' | 'center'; width?: number; kind?: 'number' | 'money' | 'date' }

type Row = Record<string, unknown>

/** ปี พ.ศ. หรือ ค.ศ. → ค.ศ. (null ถ้าไม่ถูกต้อง) */
function parseYear(raw: string): number | null | undefined {
  const text = raw.trim()
  if (!text) return undefined
  if (!/^\d{4}$/.test(text)) return null
  const n = Number(text)
  const year = n >= 2400 ? n - 543 : n
  return year >= 1900 && year <= 2300 ? year : null
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

/** วันที่ของเครื่องมือมาตรฐานเก็บเป็นข้อความหลายรูปแบบ (ISO, d/m/yyyy พ.ศ./ค.ศ.) */
function parseLooseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const text = String(value ?? '').trim()
  if (!text) return null
  const local = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (local) {
    let year = Number(local[3])
    if (year >= 2400) year -= 543
    const d = new Date(Date.UTC(year, Number(local[2]) - 1, Number(local[1])))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d
}

function addMonths(base: Date, months: number) {
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(base.getUTCDate(), lastDay))
  return next
}

function buddhistYear(value: unknown): number | null {
  const d = toDate(value)
  return d ? d.getFullYear() + 543 : null
}

const money = (v: unknown) => Math.round(Number(v || 0) * 100) / 100

function deviceCategory(row: any) {
  if (row.calibrationType === 'iso') {
    const m = getIsoMethod(String(row.isoMethodCode || ''))
    return m?.deviceType ? `ISO — ${m.deviceType}` : 'ISO'
  }
  return 'ทั่วไป'
}

function hospitalTitle(unitName: string, units: UnitRefLike[]) {
  const canonical = normalizeHospitalUnitFromRefs(unitName, units) || unitName
  return displayHospitalName(canonical).title || canonical || 'ไม่ระบุหน่วยงาน'
}

function joinCertNos(certNos: string[]) {
  const list = Array.from(new Set(certNos.filter(Boolean))).sort()
  if (list.length <= 3) return list.join(', ')
  return `${list.slice(0, 3).join(', ')} … (+${list.length - 3})`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = String(searchParams.get('type') || 'unit') as TorReportType
  if (!TOR_REPORT_TYPES.includes(type)) return NextResponse.json({ error: 'ประเภทรายงานไม่ถูกต้อง' }, { status: 400 })

  const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'json'
  const yearParsed = parseYear(String(searchParams.get('year') || ''))
  if (yearParsed === null) return NextResponse.json({ error: 'กรุณาระบุปี พ.ศ. หรือ ค.ศ. 4 หลัก' }, { status: 400 })
  const year = yearParsed
  let unitName = String(searchParams.get('unitName') || '').trim().slice(0, 200)
  const deviceName = String(searchParams.get('deviceName') || '').trim().slice(0, 200)
  const allStatuses = searchParams.get('status') === 'all'

  const role = (session.user as any)?.role as string | undefined
  if (role === 'hospital_user' && (type === 'standards' || type.startsWith('savings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()

  const scope = await resolveHospitalScope(session.user)
  if (scope.kind === 'forbidden') return NextResponse.json({ error: scope.reason }, { status: 403 })

  const unitDocs = mongoose.connection.db
    ? await mongoose.connection.db.collection('unitnames').find({}, { projection: { name: 1, thaiName: 1 } }).limit(5000).toArray()
    : []
  const units = unitDocs as UnitRefLike[]

  // ---------- ขอบเขตข้อมูล ----------
  const match: Record<string, unknown> = { savedOnce: { $ne: false } }
  if (!allStatuses) match.approvalStatus = 'approved'
  if (scope.kind === 'units') {
    match.unitName = { $in: scope.units }
    unitName = scope.units[0]
  } else if (unitName && (type === 'unit' || type === 'yearly')) {
    const variants = await getUnitVariants(unitName)
    match.unitName = { $in: variants.length ? variants : [unitName] }
  }
  if (deviceName && type === 'yearly') {
    match.deviceName = { $regex: deviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }
  if (year !== undefined && type !== 'savings-yearly' && type !== 'standards') {
    // calDate อาจถูกเก็บเป็น Date หรือข้อความ (ข้อมูลนำเข้า) จึงแปลงก่อนเทียบปี
    match.$expr = { $eq: [{ $year: { $convert: { input: '$calDate', to: 'date', onError: null, onNull: null } } }, year] }
  }

  // ปี พ.ศ. ที่มีข้อมูล (สำหรับตัวเลือกในหน้า)
  const yearScope: Record<string, unknown> = { savedOnce: { $ne: false } }
  if (scope.kind === 'units') yearScope.unitName = { $in: scope.units }
  const yearRows = type === 'standards' ? [] : await CalibrationRecord.aggregate([
    { $match: yearScope },
    { $project: { y: { $year: { $convert: { input: '$calDate', to: 'date', onError: null, onNull: null } } } } },
    { $match: { y: { $ne: null } } },
    { $group: { _id: '$y' } },
    { $sort: { _id: -1 } },
    { $limit: 100 },
  ])
  const years = (yearRows as any[]).map((r) => Number(r._id) + 543)

  const meta = REPORT_META[type]
  const filters = {
    year: year !== undefined ? year + 543 : null,
    unitName: unitName || null,
    unitTitle: unitName ? hospitalTitle(unitName, units) : null,
    deviceName: deviceName || null,
    status: allStatuses ? 'all' : 'approved',
  }

  let columns: Column[] = []
  let rows: Row[] = []
  let total: Row | null = null

  if (type === 'standards') {
    const db = mongoose.connection.db
    const roots = db
      ? await db.collection('stdinstrumentrefs').find({}).sort({ no: 1 }).limit(5000).toArray()
      : []
    const projected = await projectLatestStandards(roots as any[])
    columns = [
      { key: 'no', header: 'ลำดับ', align: 'center', width: 8 },
      { key: 'name', header: 'ชื่อเครื่องมือ', width: 32 },
      { key: 'manufacture', header: 'ยี่ห้อ', width: 18 },
      { key: 'model', header: 'รุ่น', width: 18 },
      { key: 'serialNo', header: 'หมายเลขเครื่อง', width: 18 },
      { key: 'calDate', header: 'วันที่สอบเทียบ (ปัจจุบัน)', align: 'center', width: 20, kind: 'date' },
      { key: 'nextCalDate', header: 'วันที่สอบเทียบ (ครั้งต่อไป)', align: 'center', width: 22, kind: 'date' },
    ]
    rows = projected.map((std: any, i: number) => {
      const root = (roots as any[]).find((r) => String(r._id) === String(std._id)) || {}
      const calDate = parseLooseDate(std.calDate)
      let next: Date | null = parseLooseDate(root.nextCalDate)
      const interval = Number(root.calIntervalMonths)
      if (!next && calDate && Number.isInteger(interval) && interval > 0) next = addMonths(calDate, interval)
      return {
        no: i + 1,
        stdNo: std.no ?? '',
        name: std.name || '',
        manufacture: std.manufacture || '',
        model: std.model || '',
        serialNo: std.serialNo || '',
        calDate: calDate ? calDate.toISOString() : String(std.calDate || ''),
        nextCalDate: next ? next.toISOString() : '',
      }
    })
  } else {
    const records = await CalibrationRecord.find(match)
      .select('certNo amedNo deviceName unitName calDate calPrice mainPrice calibrationType isoMethodCode')
      .sort({ calDate: 1, recordNo: 1 })
      .limit(MAX_ROWS)
      .lean() as any[]

    if (type === 'unit') {
      columns = [
        { key: 'no', header: 'ลำดับ', align: 'center', width: 8 },
        { key: 'certNo', header: 'หมายเลขใบรับรองผล', width: 20 },
        { key: 'amedNo', header: 'รหัสเครื่องมือ (Amed No.)', width: 20 },
        { key: 'deviceName', header: 'ชื่อเครื่องมือ', width: 34 },
        { key: 'calPrice', header: 'ค่าสอบเทียบ (บาท)', align: 'right', width: 18, kind: 'money' },
        { key: 'mainPrice', header: 'ค่าปรนนิบัติบำรุง (บาท)', align: 'right', width: 20, kind: 'money' },
      ]
      let calSum = 0, mainSum = 0
      rows = records.map((r, i) => {
        const cal = money(r.calPrice), main = money(r.mainPrice)
        calSum += cal; mainSum += main
        return { no: i + 1, certNo: r.certNo || '', amedNo: r.amedNo ?? '', deviceName: r.deviceName || '', calPrice: cal, mainPrice: main }
      })
      total = { no: '', certNo: 'รวมทั้งสิ้น', amedNo: '', deviceName: `${rows.length} เครื่อง`, calPrice: money(calSum), mainPrice: money(mainSum) }
    } else if (type === 'yearly') {
      columns = [
        { key: 'no', header: 'ลำดับ', align: 'center', width: 8 },
        { key: 'certNo', header: 'หมายเลขใบรับรองผล', width: 28 },
        { key: 'unitTitle', header: 'ชื่อหน่วยรับบริการ', width: 30 },
        { key: 'category', header: 'ประเภทเครื่องมือ', width: 18 },
        { key: 'deviceName', header: 'ชื่อเครื่องมือ', width: 32 },
        { key: 'count', header: 'จำนวน (เครื่อง)', align: 'right', width: 14, kind: 'number' },
        { key: 'calPrice', header: 'ค่าสอบเทียบ (บาท)', align: 'right', width: 18, kind: 'money' },
      ]
      const groups = new Map<string, { unitTitle: string; category: string; deviceName: string; certNos: string[]; count: number; calPrice: number }>()
      for (const r of records) {
        const unitTitle = hospitalTitle(String(r.unitName || ''), units)
        const category = deviceCategory(r)
        const device = String(r.deviceName || '').trim() || 'ไม่ระบุเครื่องมือ'
        const key = `${unitTitle}\u0000${category}\u0000${device}`
        const g = groups.get(key) || { unitTitle, category, deviceName: device, certNos: [], count: 0, calPrice: 0 }
        g.certNos.push(String(r.certNo || ''))
        g.count += 1
        g.calPrice += money(r.calPrice)
        groups.set(key, g)
      }
      let count = 0, calSum = 0
      rows = Array.from(groups.values())
        .sort((a, b) => a.unitTitle.localeCompare(b.unitTitle, 'th') || a.category.localeCompare(b.category, 'th') || a.deviceName.localeCompare(b.deviceName, 'th'))
        .map((g, i) => {
          count += g.count; calSum += g.calPrice
          return { no: i + 1, certNo: joinCertNos(g.certNos), unitTitle: g.unitTitle, category: g.category, deviceName: g.deviceName, count: g.count, calPrice: money(g.calPrice) }
        })
      total = { no: '', certNo: 'รวม', unitTitle: '', category: '', deviceName: '', count, calPrice: money(calSum) }
    } else if (type === 'savings') {
      columns = [
        { key: 'no', header: 'ลำดับ', align: 'center', width: 8 },
        { key: 'unitTitle', header: 'ชื่อหน่วยรับบริการ', width: 36 },
        { key: 'count', header: 'จำนวนงานสอบเทียบ (เครื่อง)', align: 'right', width: 22, kind: 'number' },
        { key: 'calPrice', header: 'ค่าสอบเทียบ (บาท)', align: 'right', width: 18, kind: 'money' },
      ]
      const groups = new Map<string, { unitTitle: string; count: number; calPrice: number }>()
      for (const r of records) {
        const unitTitle = hospitalTitle(String(r.unitName || ''), units)
        const g = groups.get(unitTitle) || { unitTitle, count: 0, calPrice: 0 }
        g.count += 1
        g.calPrice += money(r.calPrice)
        groups.set(unitTitle, g)
      }
      let count = 0, calSum = 0
      rows = Array.from(groups.values())
        .sort((a, b) => b.calPrice - a.calPrice || a.unitTitle.localeCompare(b.unitTitle, 'th'))
        .map((g, i) => { count += g.count; calSum += g.calPrice; return { no: i + 1, unitTitle: g.unitTitle, count: g.count, calPrice: money(g.calPrice) } })
      total = { no: '', unitTitle: 'รวม', count, calPrice: money(calSum) }
    } else {
      columns = [
        { key: 'year', header: 'ปี พ.ศ.', align: 'center', width: 12 },
        { key: 'count', header: 'จำนวนงานสอบเทียบ (เครื่อง)', align: 'right', width: 22, kind: 'number' },
        { key: 'calPrice', header: 'ค่าสอบเทียบ (บาท)', align: 'right', width: 18, kind: 'money' },
        { key: 'note', header: 'หมายเหตุ', width: 30 },
      ]
      const groups = new Map<number, { count: number; calPrice: number; units: Set<string> }>()
      let unknown = 0
      for (const r of records) {
        const y = buddhistYear(r.calDate)
        if (!y) { unknown += 1; continue }
        const g = groups.get(y) || { count: 0, calPrice: 0, units: new Set<string>() }
        g.count += 1
        g.calPrice += money(r.calPrice)
        g.units.add(hospitalTitle(String(r.unitName || ''), units))
        groups.set(y, g)
      }
      let count = 0, calSum = 0
      rows = Array.from(groups.entries())
        .sort(([a], [b]) => a - b)
        .map(([y, g]) => { count += g.count; calSum += g.calPrice; return { year: y, count: g.count, calPrice: money(g.calPrice), note: `${g.units.size} หน่วยรับบริการ` } })
      total = { year: 'รวม', count, calPrice: money(calSum), note: unknown ? `ไม่ระบุวันที่สอบเทียบ ${unknown} รายการ` : '' }
    }
  }

  const title = `${meta.code} ${meta.title}`
  const subtitle = [
    filters.year ? `ปี พ.ศ. ${filters.year}` : type === 'standards' ? '' : 'ทุกปี',
    filters.unitTitle ? `หน่วยรับบริการ ${filters.unitTitle}` : (type === 'unit' || type === 'yearly') ? 'ทุกหน่วยรับบริการ' : '',
    filters.deviceName ? `เครื่องมือ "${filters.deviceName}"` : '',
    type === 'standards' ? '' : allStatuses ? 'ทุกสถานะ' : 'เฉพาะรายการที่อนุมัติแล้ว',
  ].filter(Boolean).join(' · ')

  if (format === 'xlsx') {
    const excelColumns: ExcelColumn[] = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }))
    const excelRows = rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.kind === 'date' ? (toDate(r[c.key]) || r[c.key] || '') : r[c.key]])))
    const buffer = await buildWorkbook([{
      name: meta.title.slice(0, 31),
      title: [title, subtitle, `พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`],
      columns: excelColumns,
      rows: excelRows,
      footer: total || undefined,
    }])
    return xlsxResponse(buffer, stampedFileName(`tor-${type}`))
  }

  return NextResponse.json(
    { type, code: meta.code, title: meta.title, subtitle, filters, years, columns, rows, total, truncated: rows.length >= MAX_ROWS },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
