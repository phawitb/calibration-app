import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import AmedDevice from '@/models/AmedDevice'
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const user = session.user as { role?: string; hospitalUnit?: string }

  let unitName = searchParams.get('unitName') || ''

  // hospital_user can only see their own hospital
  if (user.role === 'hospital_user') {
    unitName = user.hospitalUnit || ''
  }

  const filter: Record<string, unknown> = { isActive: { $ne: false } }
  if (unitName) {
    const variants = await getUnitVariants(unitName)
    filter.unitName = variants.length > 1 ? { $in: variants } : variants[0] || unitName
  }

  const devices = await AmedDevice.find(filter).sort({ amedNo: 1 }).lean()
  return NextResponse.json({ data: devices })
}
