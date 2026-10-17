import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { calculateRecord } from '@/lib/calculateRecord'
import { isVerdict } from '@/lib/acceptance'
import { buildVerdictPatch, UC_KEYS } from '@/lib/recordAcceptance'

/**
 * กำหนดผลการตัดสิน ผ่าน/ไม่ผ่าน/N/A เอง (ต่อจุด หรือผลรวม) จากหน้าคำนวณ
 * body: { group: 'uc1'..'ucT' | 'iso', index: number, verdict: 'pass'|'fail'|'na'|'' }
 *   หรือ { overall: 'pass'|'fail'|'na'|'' }   ('' = ยกเลิกค่าที่กำหนดเอง กลับไปใช้ค่าที่คำนวณ)
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const status = (record as any).approvalStatus
  if (status === 'approved' || status === 'pending_approval') {
    return NextResponse.json(
      { error: status === 'approved' ? 'ใบรับรองนี้อนุมัติแล้ว แก้ไขผลการตัดสินไม่ได้' : 'รายการอยู่ระหว่างรออนุมัติ กรุณาบันทึกเป็นฉบับร่างก่อนแก้ไขผลการตัดสิน' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const set: Record<string, unknown> = {}
  const unset: Record<string, 1> = {}
  const normalize = (value: unknown) => {
    if (value === '' || value == null) return null
    if (!isVerdict(value)) throw new Error('ค่าผลการตัดสินไม่ถูกต้อง')
    return value
  }

  try {
    if ('overall' in body) {
      const v = normalize(body.overall)
      if (v) set.overallVerdictOverride = v
      else unset.overallVerdictOverride = 1
    } else {
      const group = String(body.group || '')
      const index = Number(body.index)
      const isUc = (UC_KEYS as readonly string[]).includes(group)
      if ((!isUc && group !== 'iso') || !Number.isInteger(index) || index < 0) {
        return NextResponse.json({ error: 'ระบุจุดสอบเทียบไม่ถูกต้อง' }, { status: 400 })
      }
      const points = isUc ? (record as any)[group]?.calPoints : (record as any).isoData?.calPoints
      if (!Array.isArray(points) || index >= points.length) {
        return NextResponse.json({ error: 'ไม่พบจุดสอบเทียบ' }, { status: 404 })
      }
      const path = isUc ? `${group}.calPoints.${index}.verdictOverride` : `isoData.calPoints.${index}.verdictOverride`
      const v = normalize(body.verdict)
      if (v) set[path] = v
      else unset[path] = 1
    }
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (Object.keys(set).length) update.$set = set
  if (Object.keys(unset).length) update.$unset = unset
  await CalibrationRecord.updateOne({ _id: params.id }, update)

  const updated = await CalibrationRecord.findById(params.id).lean()
  const calculation = await calculateRecord(updated)
  const patch = buildVerdictPatch(updated, calculation.acceptanceResult)
  if (Object.keys(patch).length) {
    await CalibrationRecord.updateOne({ _id: params.id }, { $set: patch }, { timestamps: false })
  }
  return NextResponse.json({ recordId: params.id, acceptanceResult: calculation.acceptanceResult })
}
