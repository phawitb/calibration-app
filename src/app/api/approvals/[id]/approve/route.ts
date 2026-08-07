import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (role !== 'admin' && role !== 'approver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  const record = await CalibrationRecord.findById(params.id)
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (record.approvalStatus !== 'pending_approval') {
    return NextResponse.json({ error: 'Record is not pending approval' }, { status: 400 })
  }
  if (
    role === 'approver' &&
    String(record.requestedApproverId || '') !== String((session.user as any).id || '')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const approverId = String((session.user as any).id || '')
  const approver = await User.findById(approverId).select('name fullName rank fullNameEn rankEn').lean()
  const approverName = String(
    `${(approver as any)?.rankEn || (approver as any)?.rank || ''} ${(approver as any)?.fullNameEn || (approver as any)?.fullName || (approver as any)?.name || (session.user as any).fullName || session.user?.name || ''}`.trim()
  )

  record.approvalStatus = 'approved'
  record.approvedById = approverId
  record.approvedByName = approverName
  record.approvedAt = new Date()
  // Issued date must always follow approval timestamp.
  record.issuedDate = new Date(record.approvedAt)
  record.approve = approverName
  await record.save()

  return NextResponse.json({ record })
}
