import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import { PIN_PATTERN } from '@/lib/approvalPin'
import { logActivity } from '@/lib/activityLog'

/** GET: มี PIN แล้วหรือยัง */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const user = await User.findById((session.user as any).id)
    .select('+approvalPinHash')
    .lean<{ approvalPinHash?: string } | null>()
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ hasPin: !!user.approvalPinHash }, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** PATCH { currentPassword, pin }: ตั้ง/เปลี่ยน PIN 4–8 หลัก (ต้องยืนยันรหัสผ่านปัจจุบัน) */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as any)?._isImpersonating) {
    return NextResponse.json({ error: 'ไม่สามารถตั้ง PIN ขณะสวมสิทธิ์ผู้ใช้อื่น' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const currentPassword = String(body?.currentPassword || '')
  const pin = String(body?.pin || '').trim()
  if (!currentPassword) return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' }, { status: 400 })
  if (!PIN_PATTERN.test(pin)) return NextResponse.json({ error: 'PIN ต้องเป็นตัวเลข 4–8 หลัก' }, { status: 400 })

  await connectDB()
  const user = await User.findById((session.user as any).id).select('+password +approvalPinHash')
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isValid = await bcrypt.compare(currentPassword, user.password)
  if (!isValid) return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })

  user.approvalPinHash = await bcrypt.hash(pin, 10)
  await user.save()
  await logActivity(req, session.user as any, 'pin_set', { targetType: 'user', targetId: user._id })
  return NextResponse.json({ success: true, hasPin: true })
}
