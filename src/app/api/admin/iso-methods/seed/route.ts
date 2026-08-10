import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import IsoMethodTemplate from '@/models/IsoMethodTemplate'
import { ISO_METHOD_SEEDS } from '@/lib/isoMethodSeeds'

// POST /api/admin/iso-methods/seed — seed/reset all method templates from Excel-derived data
export async function POST() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await connectDB()

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  }

  for (const seed of ISO_METHOD_SEEDS) {
    try {
      const existing = await IsoMethodTemplate.findOne({ code: seed.code })
      if (existing) {
        // Update existing — preserve any manual customizations by merging
        await IsoMethodTemplate.updateOne({ code: seed.code }, { $set: seed })
        results.updated++
      } else {
        await IsoMethodTemplate.create(seed)
        results.created++
      }
    } catch (err: any) {
      results.errors.push(`${seed.code}: ${err.message}`)
    }
  }

  return NextResponse.json({
    success: true,
    message: `Seeded ${results.created} new, updated ${results.updated}, ${results.errors.length} errors`,
    ...results,
  })
}
