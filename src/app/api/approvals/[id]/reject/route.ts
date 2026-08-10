import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (role !== 'admin' && role !== 'approver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const comment = String(body?.comment || '').trim()
  if (!comment) {
    return NextResponse.json({ error: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' }, { status: 400 })
  }

  await connectDB()
  const record = await CalibrationRecord.findById(params.id)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (record.approvalStatus !== 'pending_approval') {
    return NextResponse.json({ error: 'Record is not pending approval' }, { status: 400 })
  }

  const rejecterId = String((session.user as any).id || '')
  const rejecter = await User.findById(rejecterId).select('name fullName fullNameEn').lean()
  const rejecterName = String(
    (rejecter as any)?.fullNameEn || (rejecter as any)?.fullName || (rejecter as any)?.name || ''
  ).trim()

  record.approvalStatus = 'rejected'
  record.rejectionComment = comment
  record.rejectedById = rejecterId
  record.rejectedByName = rejecterName
  record.rejectedAt = new Date()
  // Clear approval fields
  record.approvedById = undefined
  record.approvedByName = undefined
  record.approvedAt = undefined
  record.approve = ''
  await record.save()

  return NextResponse.json({ record })
}
