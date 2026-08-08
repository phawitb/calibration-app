import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

/** POST: start impersonating a user (admin only) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const realRole = (session?.user as any)?.role
  if (realRole !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  await connectDB()
  const target = await User.findById(userId).lean()
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const cookieStore = await cookies()
  cookieStore.set('impersonate_user_id', userId, {
    path: '/',
    httpOnly: false, // client needs to read this
    maxAge: 60 * 60 * 4, // 4 hours
    sameSite: 'lax',
  })

  const role = (target as any).role === 'user' ? 'hospital_user' : (target as any).role
  return NextResponse.json({
    ok: true,
    user: {
      id: (target as any)._id.toString(),
      username: (target as any).username,
      fullName: (target as any).fullName || (target as any).name,
      rank: (target as any).rank || '',
      fullNameEn: (target as any).fullNameEn || '',
      rankEn: (target as any).rankEn || '',
      hospitalUnit: (target as any).hospitalUnit || '',
      amedNo: (target as any).amedNo || '',
      role,
    },
  })
}

/** DELETE: stop impersonating */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.delete('impersonate_user_id')
  return NextResponse.json({ ok: true })
}
