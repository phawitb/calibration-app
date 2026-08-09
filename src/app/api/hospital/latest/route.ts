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

/** Get latest calibration record per amedNo for a hospital unit */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const unitName = searchParams.get('unitName') || ''
  if (!unitName) return NextResponse.json({ data: [] })

  const unitVariants = await getUnitVariants(unitName)

  const pipeline = [
    {
      $match: {
        unitName: { $in: unitVariants },
        approvalStatus: 'approved',
        savedOnce: { $ne: false },
      },
    },
    { $sort: { calDate: -1 as const } },
    {
      $group: {
        _id: '$amedNo',
        amedNo: { $first: '$amedNo' },
        calDate: { $first: '$calDate' },
        certNo: { $first: '$certNo' },
        approvalStatus: { $first: '$approvalStatus' },
      },
    },
  ]

  const results = await CalibrationRecord.aggregate(pipeline)
  return NextResponse.json({ data: results })
}
