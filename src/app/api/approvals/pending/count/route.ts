import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'

function canSeeApprovals(role: string | undefined) {
  return role === 'admin' || role === 'approver'
}

function buildScope(sessionUser: any) {
  const role = sessionUser?.role
  if (role === 'admin') return {}
  return { requestedApproverId: String(sessionUser?.id || '') }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (!canSeeApprovals(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const count = await CalibrationRecord.countDocuments({
    approvalStatus: 'pending_approval',
    ...buildScope(session.user as any),
  })
  return NextResponse.json({ count })
}
