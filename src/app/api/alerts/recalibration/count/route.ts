import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { calcRecalibrationDates, getRecalibrationSettings } from '@/lib/recalibration'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role as string | undefined
  if (!role || !['admin', 'technician', 'approver'].includes(role)) {
    return NextResponse.json({ count: 0 })
  }

  await connectDB()
  const scope: any = {}

  const { certValidityMonths, alertBeforeDays } = await getRecalibrationSettings()
  const { dueBoundary, expiringStart, expiringEnd } = calcRecalibrationDates(new Date(), certValidityMonths, alertBeforeDays)

  const expiringSoon = await CalibrationRecord.countDocuments({
    ...scope,
    approvalStatus: 'approved',
    calDate: { $gte: expiringStart, $lte: expiringEnd },
  })
  const overdue = await CalibrationRecord.countDocuments({
    ...scope,
    approvalStatus: 'approved',
    calDate: { $lte: dueBoundary },
  })

  return NextResponse.json({ count: expiringSoon + overdue, expiringSoon, overdue })
}
