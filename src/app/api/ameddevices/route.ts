import { AMED_UC_KEYS, normalizeAmedUcFields } from '@/lib/amedUcOptions'
import {getOrder,listOrders} from '@/lib/workOrderService'
import {orderFailure} from '@/lib/workOrderHttp'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import AmedDevice from '@/models/AmedDevice'
import { getUnitVariants } from '@/lib/unitVariants'

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const user = session.user as { role?: string; hospitalUnit?: string }

  let unitName = searchParams.get('unitName') || ''

  if (user.role === 'hospital_user') {
    if (!user.hospitalUnit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    unitName = user.hospitalUnit
  }

  const filter: Record<string, unknown> = { isActive: { $ne: false } }
  if (unitName) {
    const variants = await getUnitVariants(unitName)
    filter.unitName = variants.length > 1 ? { $in: variants } : variants[0] || unitName
  }

  const orderKey = searchParams.get('workOrderId')
  if (orderKey) {
    const orders = orderKey === 'all' ? await listOrders(session.user as any) : [await getOrder(session.user as any, orderKey)]
    filter._id = {$in: orders.flatMap((order:any)=>order.hospitals.flatMap((h:any)=>h.deviceIds))}
  }
  const devices = await AmedDevice.find(filter).sort({ amedNo: 1 }).lean()
  return NextResponse.json({ data: devices.map(normalizeAmedUcFields) })
  } catch(e) {return orderFailure(e)}
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as { role?: string })?.role
  if (role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const requestedAmedNo = String(body?.amedNo || '').trim()
  const unitName = String(body?.unitName || '').trim()
  if (!unitName) {
    return NextResponse.json({ error: 'กรุณาระบุโรงพยาบาล' }, { status: 400 })
  }
  if (requestedAmedNo.length > 100) {
    return NextResponse.json({ error: 'AmedNo ต้องไม่เกิน 100 ตัวอักษร' }, { status: 400 })
  }

  let ucFields: Record<string, unknown>
  try {
    ucFields = normalizeAmedUcFields(Object.fromEntries(AMED_UC_KEYS.map(key => [key, body?.[key]])))
  } catch {
    return NextResponse.json({ error: 'รูปแบบรายการ UC ไม่ถูกต้อง' }, { status: 400 })
  }

  await connectDB()
  // AmedNo ว่าง → สร้างรหัสอัตโนมัติ AUTO-<พ.ศ.>-NNNN (ลำดับถัดไปในปีนั้น) และลองใหม่เมื่อชนกัน (TOR 1.2.1.3)
  const autoGenerate = !requestedAmedNo
  for (let attempt = 0; attempt < 5; attempt++) {
  const amedNo = autoGenerate ? await nextAutoAmedNo() : requestedAmedNo
  try {
    const created = await AmedDevice.create({
      ...ucFields,
      amedNo,
      unitName,
      section: String(body?.section || '').trim(),
      deviceName: String(body?.deviceName || '').trim(),
      brand: String(body?.brand || '').trim(),
      model: String(body?.model || '').trim(),
      serialNo: String(body?.serialNo || '').trim(),
      hpNumber: String(body?.hpNumber || '').trim(),
      toSelect: true,
      isActive: true,
    })
    return NextResponse.json({ data: JSON.parse(JSON.stringify(created)), generatedAmedNo: autoGenerate ? amedNo : undefined }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 11000) {
      if (autoGenerate) continue
      return NextResponse.json({ error: 'มี AmedNo นี้ในหน่วยงานนี้อยู่แล้ว' }, { status: 409 })
    }
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มรายการได้' }, { status: 500 })
  }
  }
  return NextResponse.json({ error: 'สร้าง AmedNo อัตโนมัติไม่สำเร็จ กรุณาลองใหม่' }, { status: 409 })
}

const AUTO_AMED_PATTERN = /^AUTO-(\d{4})-(\d{4,})$/
/** รหัสอัตโนมัติถัดไปของปี พ.ศ. ปัจจุบัน: AUTO-<พ.ศ.>-NNNN (นับต่อจากเลขสูงสุดที่มีในระบบ ไม่แยกตามหน่วยงาน) */
async function nextAutoAmedNo() {
  const beYear = new Date().getFullYear() + 543
  const prefix = `AUTO-${beYear}-`
  const rows = await AmedDevice.find({ amedNo: { $regex: `^${prefix}\\d{4,}$` } }).select('amedNo').lean() as { amedNo?: string }[]
  let max = 0
  for (const row of rows) {
    const match = AUTO_AMED_PATTERN.exec(String(row.amedNo || ''))
    if (match) max = Math.max(max, Number(match[2]))
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
