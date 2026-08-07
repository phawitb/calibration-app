import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const currentPassword = String(body?.currentPassword || '')
  const newPassword = String(body?.newPassword || '')
  if (!currentPassword || !newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: 'Invalid password payload' }, { status: 400 })
  }

  await connectDB()
  const user = await User.findOne({ username: (session.user as any).username })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 })

  user.password = await bcrypt.hash(newPassword, 10)
  await user.save()
  return NextResponse.json({ success: true })
}
