import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { calculateRecord } from '@/lib/calculateRecord'
import { getUnitVariants } from '@/lib/unitVariants'
import { buildVerdictPatch } from '@/lib/recordAcceptance'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'hospital_user') {
    if (!hospitalUnit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const allowed = await getUnitVariants(hospitalUnit)
    if (!allowed.includes(String((record as any).unitName || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const calculation = await calculateRecord(record)
    // บันทึกผลการตัดสิน (ผ่าน/ไม่ผ่าน/N/A) ลง record โดยไม่แตะ updatedAt — ค่าที่ผู้ใช้กำหนดเองยังคงอยู่
    const patch = buildVerdictPatch(record, calculation.acceptanceResult)
    if (Object.keys(patch).length) {
      await CalibrationRecord.updateOne({ _id: params.id }, { $set: patch }, { timestamps: false }).catch(() => null)
    }
    return NextResponse.json({ recordId: params.id, ...calculation })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'คำนวณไม่สำเร็จ' }, { status: 422 })
  }
}
