import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StdCalPointConfig from '@/models/StdCalPointConfig'

/** GET cal point configs for a standard instrument (any authenticated user) */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const instrumentId = searchParams.get('instrumentId')
  if (!instrumentId) return NextResponse.json({ error: 'instrumentId required' }, { status: 400 })

  await connectDB()
  const configs = await StdCalPointConfig.find({ instrumentRefId: instrumentId })
    .sort({ order: 1, createdAt: 1 })
    .lean()
  return NextResponse.json({ data: configs })
}
