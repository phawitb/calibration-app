import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

// Lazy-load reference models
function getModel(name: string, schema: mongoose.Schema) {
  return mongoose.models[name] || mongoose.model(name, schema)
}

const baseSchema = new mongoose.Schema({}, { strict: false })

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'devices'

  const modelMap: Record<string, string> = {
    devices:   'DeviceName',
    units:     'UnitName',
    sections:  'SectionName',
    calnames:  'CalName',
    calprices: 'CalPrice',
    stdinstruments: 'StdInstrumentRef',
    brands:    'BrandName',
    ameddevices: 'AmedDevice',
  }

  const modelName = modelMap[type]
  if (!modelName) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const Model = getModel(modelName, baseSchema)
  const data  = await Model.find({}).lean()
  return NextResponse.json({ data, type })
}
