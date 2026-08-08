import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

const modelMap: Record<string, string> = {
  devices: 'DeviceName',
  units: 'UnitName',
  sections: 'SectionName',
  calnames: 'CalName',
  stdinstruments: 'StdInstrumentRef',
  brands: 'BrandName',
  ameddevices: 'AmedDevice',
}

const baseSchema = new mongoose.Schema({}, { strict: false, collection: undefined })

function getModel(mongooseName: string) {
  return mongoose.models[mongooseName] || mongoose.model(mongooseName, baseSchema)
}

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') return null
  return s
}

function resolveType(type: string | null) {
  if (!type) return null
  return modelMap[type] ? type : null
}

/** สร้างเอกสารอ้างอิง (admin) */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const { type, ...doc } = body
  const t = resolveType(String(type))
  if (!t) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!Object.keys(doc).length) {
    return NextResponse.json({ error: 'Empty document' }, { status: 400 })
  }
  await connectDB()
  const M = getModel(modelMap[t])
  const created = await M.create(doc)
  return NextResponse.json({ data: JSON.parse(JSON.stringify(created)) }, { status: 201 })
}

/** อัปเดต */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const { type, _id, ...data } = body
  const t = resolveType(String(type))
  if (!t || !body._id) {
    return NextResponse.json({ error: 'Invalid type or _id' }, { status: 400 })
  }
  await connectDB()
  const M = getModel(modelMap[t])
  const id = new mongoose.Types.ObjectId(String(_id))
  const updated = await M.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: false }
  )
    .lean()
    .exec()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: updated })
}

/** ลบ */
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const type = resolveType(searchParams.get('type'))
  const id = searchParams.get('id')
  if (!type || !id) {
    return NextResponse.json({ error: 'type and id required' }, { status: 400 })
  }
  await connectDB()
  const M = getModel(modelMap[type])
  const r = await M.findByIdAndDelete(new mongoose.Types.ObjectId(id))
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
