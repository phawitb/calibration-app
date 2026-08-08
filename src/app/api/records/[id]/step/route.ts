import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'

const VALID_STEPS = ['edit', 'calc', 'preview'] as const

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const step = String(body?.step || '')
  if (!VALID_STEPS.includes(step as any)) {
    return NextResponse.json({ error: 'Invalid step' }, { status: 400 })
  }

  await connectDB()
  await CalibrationRecord.findByIdAndUpdate(params.id, { lastStep: step })
  return NextResponse.json({ ok: true })
}
