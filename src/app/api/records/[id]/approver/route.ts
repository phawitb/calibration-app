import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'
import mongoose from 'mongoose'

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'technician'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const approverId = body?.requestedApproverId
  if (
    !mongoose.isValidObjectId(params.id) ||
    typeof approverId !== 'string' ||
    !mongoose.isValidObjectId(approverId)
  ) {
    return NextResponse.json(
      { error: 'กรุณาเลือกผู้อนุมัติที่ถูกต้อง' },
      { status: 400 }
    )
  }
  await connectDB()
  const approver = await User.findOne({
    _id: approverId,
    role: { $in: ['admin', 'approver'] },
    isActive: { $ne: false },
  })
    .select('name fullName fullNameEn')
    .lean<{ name?: string; fullName?: string; fullNameEn?: string }>()
  if (!approver) {
    return NextResponse.json(
      { error: 'ไม่พบผู้อนุมัติที่ใช้งานได้' },
      { status: 400 }
    )
  }
  // Check status in the write itself so a completed approval cannot be reopened.
  const record = await CalibrationRecord.findOneAndUpdate(
    { _id: params.id, approvalStatus: 'pending_approval' },
    {
      $inc: { certificateRevision: 1 },
      $set: {
        requestedApproverId: approverId,
        requestedApproverName: String(
          approver.fullNameEn || approver.fullName || approver.name || ''
        ).trim(),
      },
    },
    { new: true, runValidators: true }
  )
  if (!record) {
    return NextResponse.json(
      { error: 'รายการไม่ได้อยู่ระหว่างรออนุมัติแล้ว กรุณาโหลดข้อมูลล่าสุด' },
      { status: 409 }
    )
  }
  return NextResponse.json({ record })
}
