import StandardInstrumentYear from '@/models/StandardInstrumentYear'
import AmedDevice from '@/models/AmedDevice'
import { normalizeAmedUcFields } from '@/lib/amedUcOptions'
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
  if (mongooseName === 'AmedDevice') return AmedDevice
  return mongoose.models[mongooseName] || mongoose.model(mongooseName, baseSchema)
}

async function requireDataManager() {
  const s = await getServerSession(authOptions)
  const role = (s?.user as { role?: string } | undefined)?.role
  if (!s || (role !== 'admin' && role !== 'technician')) return null
  return s
}

function resolveType(type: string | null) {
  if (!type) return null
  return modelMap[type] ? type : null
}

function referenceFailure(error: unknown) {
  if (error instanceof SyntaxError || error instanceof mongoose.Error.CastError || error instanceof mongoose.Error.ValidationError) {
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง กรุณาตรวจสอบค่าที่กรอก' }, { status: 400 })
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    return NextResponse.json({ error: 'มีรายการนี้อยู่แล้ว กรุณาตรวจสอบข้อมูลซ้ำ' }, { status: 409 })
  }
  console.error('Reference operation failed', error)
  return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
}

/** สร้างเอกสารอ้างอิง (admin) */
export async function POST(req: NextRequest) {
  try {
    if (!(await requireDataManager())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const { type, ...doc } = body
    const t = resolveType(String(type))
    if (!t) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    if (!Object.keys(doc).length) {
      return NextResponse.json({ error: 'Empty document' }, { status: 400 })
    }
    try {
      if (t === 'ameddevices') Object.assign(doc, normalizeAmedUcFields(doc))
    } catch {
      return NextResponse.json({ error: 'รูปแบบรายการ UC ไม่ถูกต้อง' }, { status: 400 })
    }
    await connectDB()
    const M = getModel(modelMap[t])
    const created = await M.create(doc)
    return NextResponse.json({ data: JSON.parse(JSON.stringify(created)) }, { status: 201 })
  } catch (error) {
    return referenceFailure(error)
  }
}

/** อัปเดต */
export async function PUT(req: NextRequest) {
  try {
    if (!(await requireDataManager())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await req.json()
    const { type, _id, ...data } = body
    const t = resolveType(String(type))
    if (!t || !body._id) {
      return NextResponse.json({ error: 'Invalid type or _id' }, { status: 400 })
    }
    try {
      if (t === 'ameddevices') Object.assign(data, normalizeAmedUcFields(data))
    } catch {
      return NextResponse.json({ error: 'รูปแบบรายการ UC ไม่ถูกต้อง' }, { status: 400 })
    }
    await connectDB()
    if (t === 'stdinstruments' && await StandardInstrumentYear.exists({ instrumentRefId: String(_id) })) {
      return NextResponse.json({ error: 'กรุณาแก้ไขในข้อมูลรายปีของเครื่องมือ' }, { status: 409 })
    }
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
  } catch (error) {
    return referenceFailure(error)
  }
}

/** ลบ */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await requireDataManager())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(req.url)
    const type = resolveType(searchParams.get('type'))
    const id = searchParams.get('id')
    if (!type || !id) {
      return NextResponse.json({ error: 'type and id required' }, { status: 400 })
    }
    await connectDB()
    if (type === 'stdinstruments' && await StandardInstrumentYear.exists({ instrumentRefId: String(id) })) {
      return NextResponse.json({ error: 'เครื่องมือนี้มีประวัติรายปี ไม่สามารถลบประวัติได้' }, { status: 409 })
    }
    const M = getModel(modelMap[type])
    const r = await M.findByIdAndDelete(new mongoose.Types.ObjectId(id))
    if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return referenceFailure(error)
  }
}
