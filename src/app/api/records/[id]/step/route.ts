import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { persistRecordStep } from '@/lib/recordStep'
import { isRecordOwner, OWNERSHIP_ERROR } from '@/lib/recordOwnership'

const VALID_STEPS = ['edit', 'calc', 'preview'] as const
const EDITOR_ROLES = ['admin', 'technician', 'approver']

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = String((session.user as any)?.role || '')
  if (!EDITOR_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json()
  const step = String(body?.step || '')
  if (!VALID_STEPS.includes(step as any)) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  }

  await connectDB()
  const exists = await CalibrationRecord.findById(params.id).select('createdBy calibratedById').lean<{ createdBy?: string; calibratedById?: string } | null>()
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // TOR 1.2.1.15: เจ้าหน้าที่บันทึกขั้นตอนได้เฉพาะรายการของตนเอง
  if (role === 'technician' && !isRecordOwner(session.user as any, exists)) {
    return NextResponse.json({ error: OWNERSHIP_ERROR }, { status: 403 })
  }
  await persistRecordStep(CalibrationRecord, params.id, step)
  return NextResponse.json({ ok: true })
}
