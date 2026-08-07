import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'
import mongoose from 'mongoose'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

async function getUnitVariants(inputRaw: unknown) {
  const input = String(inputRaw || '').trim()
  if (!input) return []
  const db = mongoose.connection.db
  if (!db) return [input]
  const rows = await db.collection('unitnames').find({}, { projection: { name: 1, thaiName: 1 } }).limit(5000).toArray()
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'hospital_user' && hospitalUnit) {
    const unitVariants = await getUnitVariants(hospitalUnit)
    if (!unitVariants.includes(String((record as any).unitName || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const r = record as any
  let calibratorSignature: string | null = null
  if (r.calibratedById) {
    const u = await User.findById(r.calibratedById).select('signaturePng').lean()
    calibratorSignature = (u as any)?.signaturePng || null
  }
  if (!calibratorSignature && r.calibrate) {
    const c = String(r.calibrate).trim()
    if (c) {
      const alt = await User.findOne({
        role: { $in: ['technician', 'admin'] },
        $or: [{ fullName: c }, { name: c }],
      })
        .select('signaturePng')
        .lean()
      calibratorSignature = (alt as any)?.signaturePng || null
    }
  }

  const showApproverSignature = r.approvalStatus === 'approved'
  let approverSignature: string | null = null
  if (showApproverSignature && r.approvedById) {
    const u2 = await User.findById(r.approvedById).select('signaturePng').lean()
    approverSignature = (u2 as any)?.signaturePng || null
  }

  return NextResponse.json({
    calibratorSignature,
    approverSignature,
    showApproverSignature,
  })
}
