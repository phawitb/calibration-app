import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getUnitVariants } from '@/lib/unitVariants'
import { displayHospitalName, normalizeHospitalUnitFromRefs, type UnitRefLike } from '@/lib/hospitalUnit'
import { ISO_METHODS } from '@/lib/isoMethods'
import mongoose from 'mongoose'

const STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  pending_approval: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ตีกลับให้แก้ไข',
}

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function parseDayStart(value: string) {
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDayEnd(value: string) {
  const d = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(d.getTime()) ? null : d
}

function canonicalHospital(raw: unknown, units: UnitRefLike[]) {
  const name = String(raw || '').trim() || 'ไม่ระบุหน่วยงาน'
  return normalizeHospitalUnitFromRefs(name, units) || name
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role as string | undefined
  if (role === 'hospital_user') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const fromRaw = String(searchParams.get('from') || '').trim()
  const toRaw = String(searchParams.get('to') || '').trim()
  const hospitalRaw = String(searchParams.get('hospital') || '').trim()

  const now = new Date()
  const from = parseDayStart(fromRaw) || new Date(now.getFullYear(), 0, 1)
  const to = parseDayEnd(toRaw) || now
  if (from > to) {
    return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 })
  }

  await connectDB()

  const match: Record<string, unknown> = {
    savedOnce: { $ne: false },
    calDate: { $gte: from, $lte: to },
  }

  if (hospitalRaw && hospitalRaw !== 'all') {
    const variants = await getUnitVariants(hospitalRaw)
    match.unitName = { $in: variants.length ? variants : [hospitalRaw] }
  }

  const [rows, unitDocs] = await Promise.all([
    CalibrationRecord.find(match)
      .select('unitName calDate calPrice mainPrice approvalStatus calibrationType isoMethodCode deviceName calibrate createdBy')
      .lean(),
    mongoose.connection.db
      ? mongoose.connection.db.collection('unitnames').find({}, { projection: { name: 1, thaiName: 1 } }).limit(5000).toArray()
      : Promise.resolve([]),
  ])

  const units = unitDocs as UnitRefLike[]
  const byHospitalMap = new Map<string, {
    name: string
    title: string
    jobs: number
    calPrice: number
    mainPrice: number
    approved: number
    pending: number
    draft: number
    rejected: number
  }>()
  const byStatusMap = new Map<string, number>()
  const byTypeMap = new Map<string, number>()
  const byMonthMap = new Map<string, { jobs: number; calPrice: number; mainPrice: number }>()
  const byTechMap = new Map<string, { jobs: number; calPrice: number }>()
  const byDeviceMap = new Map<string, number>()
  const byMethodMap = new Map<string, number>()

  let calPrice = 0
  let mainPrice = 0

  for (const row of rows as any[]) {
    const hospital = canonicalHospital(row.unitName, units)
    const status = String(row.approvalStatus || 'draft')
    const type = row.calibrationType === 'iso' ? 'iso' : 'sbcal'
    const price = Number(row.calPrice || 0)
    const maint = Number(row.mainPrice || 0)
    const tech = String(row.calibrate || row.createdBy || '').trim() || 'ไม่ระบุผู้สอบเทียบ'
    const device = String(row.deviceName || '').trim() || 'ไม่ระบุเครื่องมือ'
    const method = row.calibrationType === 'iso'
      ? (() => {
          const code = String(row.isoMethodCode || 'ISO')
          const found = ISO_METHODS.find((m) => m.code === code)
          return found ? `${code} ${found.nameTh}` : code
        })()
      : 'ระบบทั่วไป'

    calPrice += price
    mainPrice += maint
    byStatusMap.set(status, (byStatusMap.get(status) || 0) + 1)
    byTypeMap.set(type, (byTypeMap.get(type) || 0) + 1)
    byDeviceMap.set(device, (byDeviceMap.get(device) || 0) + 1)
    byMethodMap.set(method, (byMethodMap.get(method) || 0) + 1)

    const hospitalRow = byHospitalMap.get(hospital) || {
      name: hospital,
      title: displayHospitalName(hospital).title || hospital,
      jobs: 0,
      calPrice: 0,
      mainPrice: 0,
      approved: 0,
      pending: 0,
      draft: 0,
      rejected: 0,
    }
    hospitalRow.jobs += 1
    hospitalRow.calPrice += price
    hospitalRow.mainPrice += maint
    if (status === 'approved') hospitalRow.approved += 1
    else if (status === 'pending_approval') hospitalRow.pending += 1
    else if (status === 'rejected') hospitalRow.rejected += 1
    else hospitalRow.draft += 1
    byHospitalMap.set(hospital, hospitalRow)

    const calDate = row.calDate ? new Date(row.calDate) : null
    if (calDate && !Number.isNaN(calDate.getTime())) {
      const key = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, '0')}`
      const monthRow = byMonthMap.get(key) || { jobs: 0, calPrice: 0, mainPrice: 0 }
      monthRow.jobs += 1
      monthRow.calPrice += price
      monthRow.mainPrice += maint
      byMonthMap.set(key, monthRow)
    }

    const techRow = byTechMap.get(tech) || { jobs: 0, calPrice: 0 }
    techRow.jobs += 1
    techRow.calPrice += price
    byTechMap.set(tech, techRow)
  }

  const jobs = rows.length
  const approved = byStatusMap.get('approved') || 0
  const pending = byStatusMap.get('pending_approval') || 0
  const draft = byStatusMap.get('draft') || 0
  const rejected = byStatusMap.get('rejected') || 0

  const byHospital = Array.from(byHospitalMap.values()).sort((a, b) => b.jobs - a.jobs)
  const byMonth = Array.from(byMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [year, mm] = month.split('-')
      const monthIdx = Number(mm) - 1
      return {
        month,
        label: `${TH_MONTHS[monthIdx] || mm} ${Number(year) + 543}`,
        ...value,
      }
    })

  return NextResponse.json({
    from: fromRaw || `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`,
    to: toRaw || `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`,
    hospital: hospitalRaw || 'all',
    totals: {
      jobs,
      hospitals: byHospital.length,
      calPrice,
      mainPrice,
      totalPrice: calPrice + mainPrice,
      approved,
      pending,
      draft,
      rejected,
      approvedRate: jobs ? approved / jobs : 0,
    },
    byHospital,
    byStatus: ['approved', 'pending_approval', 'draft', 'rejected'].map((key) => ({
      key,
      label: STATUS_LABELS[key],
      count: byStatusMap.get(key) || 0,
    })),
    byType: [
      { key: 'sbcal', label: 'ระบบทั่วไป', count: byTypeMap.get('sbcal') || 0 },
      { key: 'iso', label: 'ระบบ ISO', count: byTypeMap.get('iso') || 0 },
    ],
    byMonth,
    byTechnician: Array.from(byTechMap.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 20),
    byDevice: Array.from(byDeviceMap.entries())
      .map(([name, jobsCount]) => ({ name, jobs: jobsCount }))
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 15),
    byMethod: Array.from(byMethodMap.entries())
      .map(([name, jobsCount]) => ({ name, jobs: jobsCount }))
      .sort((a, b) => b.jobs - a.jobs),
  })
}
