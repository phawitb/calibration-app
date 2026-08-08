import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StdCalPointConfig from '@/models/StdCalPointConfig'
import mongoose from 'mongoose'

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
    .sort({ order: 1, createdAt: 1 })
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
  const { points, stdValues, _id } = body

  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ error: 'points required' }, { status: 400 })
  }

  if (_id) {
    // Update
    const objectId = new mongoose.Types.ObjectId(_id)
    const updated = await StdCalPointConfig.findOneAndUpdate(
      { _id: objectId, instrumentRefId: params.id },
      { $set: { points, stdValues: stdValues || [] } },
      { new: true }
    ).lean()
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: updated })
  }

  // Auto-generate tableName: table1, table2, ...
  const existing = await StdCalPointConfig.countDocuments({ instrumentRefId: params.id })
  const tableName = `table${existing + 1}`

  // Set order to next available
  const maxOrder = await StdCalPointConfig.findOne({ instrumentRefId: params.id })
    .sort({ order: -1 }).lean()
  const order = maxOrder ? ((maxOrder as any).order || 0) + 1 : 0

  const created = await StdCalPointConfig.create({
    instrumentRefId: params.id,
    tableName,
    points,
    stdValues: stdValues || [],
    order,
  })
  return NextResponse.json({ data: created }, { status: 201 })
}

/** PATCH: reorder cal point configs */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const body = await req.json()
  const { orderedIds } = body

  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
  }

  // Update order for each config
  const ops = orderedIds.map((id: string, index: number) =>
    StdCalPointConfig.updateOne(
      { _id: id, instrumentRefId: params.id },
      { $set: { order: index } }
    )
  )
  await Promise.all(ops)

  return NextResponse.json({ ok: true })
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
