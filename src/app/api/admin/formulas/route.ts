import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalculationFormula from '@/models/CalculationFormula'

async function ensureStandardFormula() {
  const existing = await CalculationFormula.findOne({ code: 'standard' }).lean()
  if (existing) return
  await CalculationFormula.create({
    code: 'standard',
    name: 'สูตรมาตรฐาน (95.45%)',
    description: 'สูตรมาตรฐานตาม GUM/JCGM 100:2008',
    isDefault: true,
    isActive: true,
    confidenceLevel: 0.9545,
    divisorNormal: 2,
    divisorRect: 1.732050808,
    numReadings: 4,
    forceK: null,
  })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  await ensureStandardFormula()
  const formulas = await CalculationFormula.find({}).sort({ isDefault: -1, createdAt: 1 }).lean()
  return NextResponse.json({ formulas })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['admin', 'technician'].includes((session.user as any).role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await req.json()
  if (body.code === 'standard')
    return NextResponse.json({ error: 'ไม่สามารถสร้างสูตรที่ใช้รหัส standard ได้' }, { status: 400 })
  const formula = new CalculationFormula(body)
  await formula.save()
  return NextResponse.json({ formula }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['admin', 'technician'].includes((session.user as any).role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await req.json()
  const { _id, ...update } = body
  const existing = await CalculationFormula.findById(_id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.isDefault)
    return NextResponse.json({ error: 'ไม่สามารถแก้ไขสูตรมาตรฐานได้' }, { status: 400 })
  Object.assign(existing, update)
  await existing.save()
  return NextResponse.json({ formula: existing })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['admin', 'technician'].includes((session.user as any).role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const existing = await CalculationFormula.findById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.isDefault)
    return NextResponse.json({ error: 'ไม่สามารถลบสูตรมาตรฐานได้' }, { status: 400 })
  await existing.deleteOne()
  return NextResponse.json({ success: true })
}
