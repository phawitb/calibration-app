import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logActivity } from '@/lib/activityLog'

/** POST: บันทึกประวัติออกจากระบบ (เรียกก่อน signOut) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })
  await logActivity(req, session.user as any, 'logout')
  return NextResponse.json({ ok: true })
}
