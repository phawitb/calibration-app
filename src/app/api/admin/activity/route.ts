import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import UserActivity, { ACTIVITY_ACTIONS } from '@/models/UserActivity'

const MAX_PAGE_SIZE = 200

/**
 * GET /api/admin/activity?username=&action=&from=&to=&page=&limit=
 * ประวัติการใช้งานระบบ (ผู้ดูแลระบบเท่านั้น) แบ่งหน้า สูงสุด 200 รายการ/หน้า
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  // ต้องเป็น admin จริง ไม่ใช่สวมสิทธิ์เป็นคนอื่นอยู่
  if (!session || user?.role !== 'admin' || user?._isImpersonating) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const username = String(sp.get('username') || '').trim()
  const action = String(sp.get('action') || '').trim()
  const from = String(sp.get('from') || '').trim()
  const to = String(sp.get('to') || '').trim()
  const pageRaw = parseInt(sp.get('page') || '1', 10)
  const limitRaw = parseInt(sp.get('limit') || '50', 10)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_PAGE_SIZE) : 50

  if (action && !(ACTIVITY_ACTIONS as string[]).includes(action)) {
    return NextResponse.json({ error: 'action ไม่ถูกต้อง' }, { status: 400 })
  }

  const query: Record<string, any> = {}
  if (username) {
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    query.username = { $regex: escaped, $options: 'i' }
  }
  if (action) query.action = action
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) {
      const d = new Date(from)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'วันที่เริ่มต้นไม่ถูกต้อง' }, { status: 400 })
      range.$gte = d
    }
    if (to) {
      const d = new Date(to)
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'วันที่สิ้นสุดไม่ถูกต้อง' }, { status: 400 })
      // ถ้าส่งมาเป็นวันล้วน (YYYY-MM-DD) ให้ครอบคลุมทั้งวัน
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) d.setHours(23, 59, 59, 999)
      range.$lte = d
    }
    query.createdAt = range
  }

  await connectDB()
  const total = await UserActivity.countDocuments(query)
  const items = await UserActivity.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  return NextResponse.json(
    { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), actions: ACTIVITY_ACTIONS },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
