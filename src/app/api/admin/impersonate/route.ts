import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cookies } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import { logActivity } from '@/lib/activityLog'

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
  cookieStore.set('impersonate_user_id', String(userId), {
    path: '/',
    httpOnly: true, // client อ่านสถานะจาก session.user._isImpersonating แทน
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 4, // 4 hours
    sameSite: 'lax',
  })
  console.info(
    `[impersonate] admin ${(session!.user as any).username} (${(session!.user as any).id}) -> ${(target as any).username} (${userId})`
  )
  await logActivity(req, session!.user as any, 'impersonate_start', {
    targetType: 'user',
    targetId: userId,
    detail: `สวมสิทธิ์ผู้ใช้ ${(target as any).username}`,
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
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.delete('impersonate_user_id')
  const u = session.user as any
  if (u?._isImpersonating) {
    await logActivity(req, { id: u._realAdminId, username: u._realAdminUsername, role: 'admin' }, 'impersonate_stop', {
      targetType: 'user',
      targetId: u.id,
      detail: `เลิกสวมสิทธิ์ผู้ใช้ ${u.username}`,
    })
  }
  return NextResponse.json({ ok: true })
}
