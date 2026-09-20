import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { calculateRecord } from '@/lib/calculateRecord'

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
  if (role === 'hospital_user' && hospitalUnit && String((record as any).unitName || '') !== String(hospitalUnit)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    return NextResponse.json({ recordId: params.id, ...await calculateRecord(record) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'คำนวณไม่สำเร็จ' }, { status: 422 })
  }
}
