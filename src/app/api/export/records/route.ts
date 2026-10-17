import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getUnitVariants } from '@/lib/unitVariants'
import { resolveHospitalScope } from '@/lib/hospitalScope'
import { calibrationDateRange, calibrationDateSearch } from '@/lib/calibrationDateSearch'
import { calcRecalibrationDates, getRecalibrationSettings } from '@/lib/recalibration'
import { getIsoMethod } from '@/lib/isoMethods'
import { buildWorkbook, stampedFileName, xlsxResponse } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 20_000

const STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ตีกลับให้แก้ไข',
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

function isIsoDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime())
}

/** ตัวกรองเดียวกับ GET /api/records (ไม่มีแบ่งหน้า) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim().slice(0, 200)
  const section = (searchParams.get('section') || '').trim().slice(0, 100)
  const cardFilter = (searchParams.get('cardFilter') || '').trim()
  const calType = searchParams.get('calType') || ''
  const status = searchParams.get('status') || ''
  const unitName = (searchParams.get('unitName') || '').trim()
  const calYear = (searchParams.get('calYear') || '').trim()
  const calDateFrom = (searchParams.get('calDateFrom') || '').trim()
  const calDateTo = (searchParams.get('calDateTo') || '').trim()
  const role = (session.user as any)?.role as string | undefined
  const myOnly = searchParams.get('myOnly') === '1'
  const currentUsername = String((session.user as any)?.username || '')

  if (calType && !['sbcal', 'iso'].includes(calType)) return NextResponse.json({ error: 'ประเภทงานไม่ถูกต้อง' }, { status: 400 })
  if (status && !Object.keys(STATUS_LABELS).includes(status)) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
  const yearRange = calYear ? calibrationDateRange(calYear) : null
  if (calYear && (!/^\d{4}$/.test(calYear) || Number(calYear) < 2400 || !yearRange)) {
    return NextResponse.json({ error: 'กรุณาระบุปี พ.ศ. 4 หลัก' }, { status: 400 })
  }
  if ((calDateFrom && !isIsoDay(calDateFrom)) || (calDateTo && !isIsoDay(calDateTo))) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง' }, { status: 400 })
  }

  const query: any = { savedOnce: { $ne: false } }
  if (role !== 'hospital_user' && myOnly && currentUsername) query.createdBy = currentUsername

  const scope = await resolveHospitalScope(session.user)
  if (scope.kind === 'forbidden') return NextResponse.json({ error: scope.reason }, { status: 403 })
  if (scope.kind === 'units') {
    query.unitName = { $in: scope.units }
  } else if (unitName) {
    const variants = await getUnitVariants(unitName)
    query.unitName = { $in: variants.length ? variants : [unitName] }
  }

  if (search) {
    const dateSearch = calibrationDateSearch(search)
    query.$or = [
      { $expr: { $eq: [{ $toString: { $ifNull: ['$amedNo', ''] } }, search] } },
      { amedNo: { $regex: search, $options: 'i' } },
      { certNo: { $regex: search, $options: 'i' } },
      { deviceName: { $regex: search, $options: 'i' } },
      { unitName: { $regex: search, $options: 'i' } },
      { serialNo: { $regex: search, $options: 'i' } },
      { $expr: { $regexMatch: { input: { $toString: { $ifNull: ['$amedNo', ''] } }, regex: search, options: 'i' } } },
      ...(dateSearch ? [dateSearch] : []),
    ]
  }
  if (section) query.section = { $regex: section, $options: 'i' }
  if (calType) query.calibrationType = calType
  if (status) query.approvalStatus = status
  if (calDateFrom || calDateTo) {
    query.calDate = {}
    if (calDateFrom) query.calDate.$gte = new Date(calDateFrom)
    if (calDateTo) query.calDate.$lte = new Date(`${calDateTo}T23:59:59.999Z`)
  }
  if (yearRange) query.calDate = yearRange

  if (cardFilter) {
    const now = new Date()
    switch (cardFilter) {
      case 'pending': query.approvalStatus = 'pending_approval'; break
      case 'approved': query.approvalStatus = 'approved'; break
      case 'draft': query.approvalStatus = 'draft'; break
      case 'week': query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) }; break
      case 'today': query.createdAt = { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) }; break
      case 'expiring':
      case 'overdue': {
        const { certValidityMonths, alertBeforeDays } = await getRecalibrationSettings()
        const { dueBoundary, expiringStart, expiringEnd } = calcRecalibrationDates(now, certValidityMonths, alertBeforeDays)
        query.approvalStatus = 'approved'
        query.calDate = cardFilter === 'expiring' ? { $gte: expiringStart, $lte: expiringEnd } : { $lte: dueBoundary }
        break
      }
      default: break
    }
  }

  const records = await CalibrationRecord.find(query)
    .select('recordNo amedNo certNo deviceName brand model serialNo unitName section receivedDate calDate issuedDate calibrate approve calPrice mainPrice approvalStatus calibrationType isoMethodCode')
    .sort({ calDate: -1, recordNo: -1 })
    .limit(MAX_ROWS)
    .lean()

  const rows = (records as any[]).map((r, i) => {
    const isIso = r.calibrationType === 'iso'
    const method = isIso
      ? (() => { const code = String(r.isoMethodCode || ''); const m = getIsoMethod(code); return m ? `${code} ${m.nameTh}` : code || 'ISO' })()
      : 'ระบบทั่วไป'
    return {
      no: i + 1,
      certNo: r.certNo || '',
      amedNo: r.amedNo ?? '',
      deviceName: r.deviceName || '',
      brand: r.brand || '',
      model: r.model || '',
      serialNo: r.serialNo || '',
      unitName: r.unitName || '',
      section: r.section || '',
      receivedDate: toDate(r.receivedDate),
      calDate: toDate(r.calDate),
      issuedDate: toDate(r.issuedDate),
      type: isIso ? 'ISO' : 'ทั่วไป',
      method,
      calibrate: r.calibrate || '',
      approve: r.approve || '',
      status: STATUS_LABELS[String(r.approvalStatus || 'draft')] || String(r.approvalStatus || ''),
      calPrice: Number(r.calPrice || 0),
      mainPrice: Number(r.mainPrice || 0),
    }
  })

  const buffer = await buildWorkbook([{
    name: 'ประวัติสอบเทียบ',
    columns: [
      { header: 'ลำดับ', key: 'no', width: 8 },
      { header: 'เลขที่ใบรับรอง', key: 'certNo', width: 18 },
      { header: 'AmedNo', key: 'amedNo', width: 14 },
      { header: 'ชื่อเครื่องมือ', key: 'deviceName', width: 30 },
      { header: 'ยี่ห้อ', key: 'brand', width: 16 },
      { header: 'รุ่น', key: 'model', width: 16 },
      { header: 'Serial No.', key: 'serialNo', width: 18 },
      { header: 'หน่วยรับบริการ', key: 'unitName', width: 32 },
      { header: 'แผนก', key: 'section', width: 18 },
      { header: 'วันที่รับเครื่อง', key: 'receivedDate', width: 14 },
      { header: 'วันที่สอบเทียบ', key: 'calDate', width: 14 },
      { header: 'วันที่ออกใบรับรอง', key: 'issuedDate', width: 16 },
      { header: 'ประเภท', key: 'type', width: 10 },
      { header: 'วิธี', key: 'method', width: 28 },
      { header: 'ผู้สอบเทียบ', key: 'calibrate', width: 24 },
      { header: 'ผู้อนุมัติ', key: 'approve', width: 24 },
      { header: 'สถานะ', key: 'status', width: 14 },
      { header: 'ค่าสอบเทียบ', key: 'calPrice', width: 14 },
      { header: 'ค่าปรนนิบัติบำรุง', key: 'mainPrice', width: 16 },
    ],
    rows,
  }])

  return xlsxResponse(buffer, stampedFileName('calibration-records'))
}
