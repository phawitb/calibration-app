import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import mongoose from 'mongoose'

const ALLOWED_FIELDS = new Set([
  'amedNo',
  'sbNo',
  'certNo',
  'deviceName',
  'brand',
  'model',
  'serialNo',
  'hpNumber',
  'unitName',
  'section',
  'address',
  'location',
  'calibrate',
  'approve',
  'receivedN',
  'std1.no',
  'std1.name',
  'std1.manufacture',
  'std1.model',
  'std1.serialNo',
  'std1.certNo',
  'std1.measurement',
  'std1.unit',
  'std1.calDate',
])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const field = (searchParams.get('field') || '').trim()
  const q = (searchParams.get('q') || '').trim()
  const limitParam = Number(searchParams.get('limit') || '15')
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 15

  if (!ALLOWED_FIELDS.has(field)) {
    return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
  }

  await connectDB()

  const query: Record<string, any> = { [field]: { $exists: true, $nin: [null, ''] } }
  if (q) query[field] = { ...query[field], $regex: q, $options: 'i' }

  const recordValues = await CalibrationRecord.distinct(field, query)
  const normalizedRecordValues = recordValues
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0)

  const extraValues: string[] = []
  const db = mongoose.connection.db
  if (!db) {
    return NextResponse.json({ field, suggestions: normalizedRecordValues.slice(0, limit) })
  }

  // Pull choices from reference collections too, so new-form typing suggests all known units/devices/sections.
  if (field === 'unitName') {
    const rows = await db.collection('unitnames')
      .find(
        q
          ? { $or: [{ name: { $regex: q, $options: 'i' } }, { thaiName: { $regex: q, $options: 'i' } }] }
          : {},
        { projection: { name: 1, thaiName: 1 } }
      )
      .limit(limit * 3)
      .toArray()
    for (const row of rows) {
      if (row?.name) extraValues.push(String(row.name).trim())
      if (row?.thaiName) extraValues.push(String(row.thaiName).trim())
    }
  } else if (field === 'section') {
    const rows = await db.collection('sectionnames')
      .find(
        q
          ? { $or: [{ name: { $regex: q, $options: 'i' } }, { thaiName: { $regex: q, $options: 'i' } }] }
          : {},
        { projection: { name: 1, thaiName: 1 } }
      )
      .limit(limit * 3)
      .toArray()
    for (const row of rows) {
      if (row?.name) extraValues.push(String(row.name).trim())
      if (row?.thaiName) extraValues.push(String(row.thaiName).trim())
    }
  } else if (field === 'deviceName') {
    const rows = await db.collection('devicenames')
      .find(
        q
          ? { $or: [{ name: { $regex: q, $options: 'i' } }, { thaiName: { $regex: q, $options: 'i' } }] }
          : {},
        { projection: { name: 1, thaiName: 1 } }
      )
      .limit(limit * 3)
      .toArray()
    for (const row of rows) {
      if (row?.name) extraValues.push(String(row.name).trim())
      if (row?.thaiName) extraValues.push(String(row.thaiName).trim())
    }
  }

  const suggestions = Array.from(new Set([...normalizedRecordValues, ...extraValues]))
    .filter((v) => (q ? v.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => a.localeCompare(b, 'th'))
    .slice(0, limit)

  return NextResponse.json({ field, suggestions })
}
