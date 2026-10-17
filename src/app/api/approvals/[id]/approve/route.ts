import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'
import { environmentApprovalError } from '@/lib/environmentCheckServer'
import { logActivity } from '@/lib/activityLog'

export async function POST(
  req: Request,
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
  // สภาวะแวดล้อมขณะสอบเทียบต้องอยู่ในเกณฑ์ก่อนอนุมัติ (TOR 1.2.2.3, 1.2.2.4)
  const envError = await environmentApprovalError(record)
  if (envError) return NextResponse.json({ error: envError }, { status: 409 })
  // Any admin or approver can approve (not restricted to requested approver)
  const approverId = String((session.user as any).id || '')
  const approver = await User.findById(approverId).select('name fullName fullNameEn').lean()
  const approverName = String(
    (approver as any)?.fullNameEn || (approver as any)?.fullName || (approver as any)?.name || (session.user as any).fullName || session.user?.name || ''
  ).trim()

  record.approvalStatus = 'approved'
  record.approvedById = approverId
  record.approvedByName = approverName
  record.approvedAt = new Date()
  // Only set issuedDate from approval if user hasn't manually set it
  if (!record.issuedDate) {
    record.issuedDate = new Date(record.approvedAt)
  }
  record.approve = approverName
  record.certificateRevision = Number(record.certificateRevision || 0) + 1
  await record.save()
  await logActivity(req, session.user as any, 'record_approve', {
    targetType: 'record',
    targetId: record._id,
    detail: [record.certNo, record.amedNo, record.deviceName].filter(Boolean).join(' · ') || undefined,
  })

  return NextResponse.json({ record })
}
