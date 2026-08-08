import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StdCalPointConfig from '@/models/StdCalPointConfig'

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') return null
  return s
}

/** List cal point configs for a standard instrument */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const configs = await StdCalPointConfig.find({ instrumentRefId: params.id })
    .sort({ createdAt: -1 })
    .lean()
  return NextResponse.json({ data: configs })
}

/** Create or update a cal point config */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const body = await req.json()
  const { tableName, points, _id } = body

  if (!tableName || !Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ error: 'tableName and points required' }, { status: 400 })
  }

  if (_id) {
    // Update
    const updated = await StdCalPointConfig.findOneAndUpdate(
      { _id, instrumentRefId: params.id },
      { $set: { tableName, points } },
      { new: true }
    ).lean()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: updated })
  }

  const created = await StdCalPointConfig.create({
    instrumentRefId: params.id,
    tableName,
    points,
  })
  return NextResponse.json({ data: created }, { status: 201 })
}

/** Delete a cal point config */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const configId = searchParams.get('configId')
  if (!configId) return NextResponse.json({ error: 'configId required' }, { status: 400 })

  await connectDB()
  const r = await StdCalPointConfig.findOneAndDelete({ _id: configId, instrumentRefId: params.id })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
