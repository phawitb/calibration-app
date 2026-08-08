import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import mongoose from 'mongoose'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

async function getUnitVariants(inputRaw: string) {
  const input = String(inputRaw || '').trim()
  if (!input) return []
  const db = mongoose.connection.db
  if (!db) return [input]
  const rows = await db.collection('unitnames')
    .find({}, { projection: { name: 1, thaiName: 1 } })
    .limit(5000)
    .toArray()
  const norm = input.toLowerCase()
  for (const row of rows) {
    const en = String((row as any)?.name || '').trim()
    const th = String((row as any)?.thaiName || '').trim()
    const label = formatHospitalUnitLabel(en, th)
    const keys = [en, th, label].map((v) => v.toLowerCase()).filter(Boolean)
    if (keys.includes(norm)) return Array.from(new Set([label, en, th].filter(Boolean)))
  }
  return [input]
}

/** Get approved calibration records for a specific AmedNo, scoped to user's hospital */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const amedNo = searchParams.get('amedNo') || ''
  const user = session.user as { role?: string; hospitalUnit?: string }

  if (!amedNo) {
    return NextResponse.json({ error: 'amedNo required' }, { status: 400 })
  }

  const query: Record<string, unknown> = {
    amedNo,
    approvalStatus: 'approved',
  }

  // Scope to user's hospital for hospital_user
  if (user.role === 'hospital_user' && user.hospitalUnit) {
    const unitVariants = await getUnitVariants(user.hospitalUnit)
    query.unitName = { $in: unitVariants }
  }

  const records = await CalibrationRecord.find(query)
    .select('amedNo certNo deviceName brand model serialNo unitName section calDate calibrate approve calibratedById approvedById approvalStatus calibrationType isoMethodCode')
    .sort({ calDate: -1 })
    .lean()

  return NextResponse.json({ data: records })
}
