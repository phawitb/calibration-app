import { NextResponse } from 'next/server'
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
  const rows = await CalculationFormula.find({ isActive: true })
    .select('_id code name description isDefault isActive confidenceLevel divisorNormal divisorRect numReadings forceK')
    .sort({ createdAt: -1 })
    .lean()

  return NextResponse.json({ formulas: rows })
}
