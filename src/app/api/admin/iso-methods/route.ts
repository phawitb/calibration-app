import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import IsoMethodTemplate from '@/models/IsoMethodTemplate'

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') return null
  return s
}

// GET /api/admin/iso-methods — list all method templates
export async function GET() {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const methods = await IsoMethodTemplate.find().sort({ sortOrder: 1, code: 1 }).lean()
  return NextResponse.json({ data: methods })
}

// POST /api/admin/iso-methods — create a new method template
export async function POST(req: NextRequest) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const body = await req.json()

  // Check for duplicate code
  const existing = await IsoMethodTemplate.findOne({ code: body.code })
  if (existing) {
    return NextResponse.json({ error: `Method code "${body.code}" already exists` }, { status: 400 })
  }

  const method = await IsoMethodTemplate.create(body)
  return NextResponse.json({ data: method }, { status: 201 })
}
