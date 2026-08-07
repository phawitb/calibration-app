import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const user = await User.findOne({ username: (session.user as any).username }).select('-password').lean()
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ user })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const fullName = String(body?.fullName || '').trim()
  const rank = String(body?.rank || '').trim()
  const name = fullName || String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  await connectDB()
  const user = await User.findOneAndUpdate(
    { username: (session.user as any).username },
    { name, fullName: fullName || name, rank },
    { new: true }
  ).select('-password').lean()

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ user })
}
