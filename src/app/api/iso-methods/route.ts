import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import IsoMethodTemplate from '@/models/IsoMethodTemplate'

// GET /api/iso-methods — public endpoint to list active method templates
// Used by the calibration form to load method configurations
export async function GET() {
  const s = await getServerSession(authOptions)
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const methods = await IsoMethodTemplate.find({ isActive: true })
    .sort({ sortOrder: 1, code: 1 })
    .lean()

  return NextResponse.json({ data: methods })
}
