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

// GET /api/admin/iso-methods/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const method = await IsoMethodTemplate.findById(id).lean()
  if (!method) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: method })
}

// PUT /api/admin/iso-methods/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const body = await req.json()

  // Don't allow changing code to a duplicate
  if (body.code) {
    const dup = await IsoMethodTemplate.findOne({ code: body.code, _id: { $ne: id } })
    if (dup) {
      return NextResponse.json({ error: `Method code "${body.code}" already exists` }, { status: 400 })
    }
  }

  const method = await IsoMethodTemplate.findByIdAndUpdate(id, body, { new: true, runValidators: true })
  if (!method) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: method })
}

// DELETE /api/admin/iso-methods/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireAdmin()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { id } = await params
  const method = await IsoMethodTemplate.findByIdAndDelete(id)
  if (!method) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
