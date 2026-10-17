import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import AmedDevice from '@/models/AmedDevice'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getUnitVariants } from '@/lib/unitVariants'
import { resolveHospitalScope } from '@/lib/hospitalScope'
import { displayHospitalName } from '@/lib/hospitalUnit'
import { buildWorkbook, stampedFileName, xlsxResponse } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 20_000

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

/** GET ?unitName= — ทะเบียนเครื่องมือของหน่วย + ใบรับรองล่าสุดต่อเครื่อง (เหมือน /api/hospital/latest) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  let unitName = (searchParams.get('unitName') || '').trim().slice(0, 200)

  const scope = await resolveHospitalScope(session.user)
  if (scope.kind === 'forbidden') return NextResponse.json({ error: scope.reason }, { status: 403 })
  if (scope.kind === 'units') unitName = scope.units[0]
  if (!unitName) return NextResponse.json({ error: 'กรุณาระบุหน่วยรับบริการ' }, { status: 400 })

  const variants = scope.kind === 'units' ? scope.units : await getUnitVariants(unitName)
  const unitFilter = { $in: variants.length ? variants : [unitName] }

  const [devices, latest] = await Promise.all([
    AmedDevice.find({ isActive: { $ne: false }, unitName: unitFilter })
      .select('amedNo unitName section deviceName brand model serialNo hpNumber')
      .sort({ amedNo: 1 })
      .limit(MAX_ROWS)
      .lean(),
    CalibrationRecord.aggregate([
      { $match: { unitName: unitFilter, approvalStatus: 'approved', savedOnce: { $ne: false } } },
      { $sort: { calDate: -1 as const } },
      { $group: { _id: '$amedNo', calDate: { $first: '$calDate' }, certNo: { $first: '$certNo' } } },
    ]),
  ])

  const latestMap = new Map<string, { calDate?: unknown; certNo?: string }>()
  for (const row of latest as any[]) latestMap.set(String(row._id ?? ''), row)

  const rows = (devices as any[]).map((d, i) => {
    const last = latestMap.get(String(d.amedNo ?? ''))
    return {
      no: i + 1,
      amedNo: d.amedNo ?? '',
      deviceName: d.deviceName || '',
      brand: d.brand || '',
      model: d.model || '',
      serialNo: d.serialNo || '',
      section: d.section || '',
      hpNumber: d.hpNumber || '',
      lastCertNo: last?.certNo || '',
      lastCalDate: toDate(last?.calDate),
    }
  })

  const title = displayHospitalName(unitName).title || unitName
  const buffer = await buildWorkbook([{
    name: 'ทะเบียนเครื่องมือ',
    title: [`ทะเบียนเครื่องมือแพทย์ — ${title}`, `จำนวน ${rows.length} เครื่อง · พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`],
    columns: [
      { header: 'ลำดับ', key: 'no', width: 8 },
      { header: 'AmedNo', key: 'amedNo', width: 14 },
      { header: 'ชื่อเครื่องมือ', key: 'deviceName', width: 30 },
      { header: 'ยี่ห้อ', key: 'brand', width: 16 },
      { header: 'รุ่น', key: 'model', width: 16 },
      { header: 'Serial No.', key: 'serialNo', width: 18 },
      { header: 'แผนก', key: 'section', width: 18 },
      { header: 'หมายเลข รพ.', key: 'hpNumber', width: 14 },
      { header: 'ใบรับรองล่าสุด', key: 'lastCertNo', width: 18 },
      { header: 'สอบเทียบล่าสุด', key: 'lastCalDate', width: 14 },
    ],
    rows,
  }])

  return xlsxResponse(buffer, stampedFileName('devices'))
}
