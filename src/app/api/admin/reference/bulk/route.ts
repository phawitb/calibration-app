import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import mongoose from 'mongoose'

const modelMap: Record<string, string> = {
  devices: 'DeviceName',
  units: 'UnitName',
  sections: 'SectionName',
  stdinstruments: 'StdInstrumentRef',
  brands: 'BrandName',
  ameddevices: 'AmedDevice',
}

const baseSchema = new mongoose.Schema({}, { strict: false, collection: undefined })

function getModel(mongooseName: string) {
  return mongoose.models[mongooseName] || mongoose.model(mongooseName, baseSchema)
}

/**
 * Bulk import: upsert rows by matching key fields.
 * Existing rows matched by _id are updated (preserving unmentioned fields).
 * New rows (no _id or _id not found) are inserted.
 * Rows not in the CSV are NOT deleted — to preserve data like PDFs.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { type, rows, expectedColumns } = body as {
    type: string
    rows: Record<string, any>[]
    expectedColumns: string[]
  }

  if (!type || !modelMap[type]) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
  }

  await connectDB()
  const M = getModel(modelMap[type])

  let updated = 0
  let created = 0

  for (const row of rows) {
    const { _id, ...data } = row
    if (_id) {
      try {
        const oid = new mongoose.Types.ObjectId(String(_id))
        const existing = await M.findById(oid)
        if (existing) {
          await M.findByIdAndUpdate(oid, { $set: data }, { runValidators: false })
          updated++
          continue
        }
      } catch {
        // Invalid _id format, treat as new
      }
    }
    await M.create(data)
    created++
  }

  return NextResponse.json({ ok: true, updated, created, total: rows.length })
}
