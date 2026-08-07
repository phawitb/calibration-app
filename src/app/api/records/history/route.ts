import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import mongoose from 'mongoose'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

async function getUnitVariants(inputRaw: unknown) {
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit
  const { searchParams } = new URL(req.url)
  const amedNo = String(searchParams.get('amedNo') || '').trim()
  if (!amedNo) return NextResponse.json({ records: [] })

  const query: any = {
    $expr: {
      $eq: [
        { $toString: { $ifNull: ['$amedNo', ''] } },
        amedNo,
      ],
    },
  }
  if (role === 'hospital_user' && hospitalUnit) {
    query.unitName = { $in: await getUnitVariants(hospitalUnit) }
  }

  const records = await CalibrationRecord.find(query)
    .select('_id amedNo amedCertKey certNo deviceName brand model serialNo calDate approvalStatus updatedAt')
    .sort({ calDate: -1, updatedAt: -1, recordNo: -1 })
    .lean()

  return NextResponse.json({ records })
}
