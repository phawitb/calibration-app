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
    unitName = user.hospitalUnit || ''
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
  return NextResponse.json({ data: devices })
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
  const amedNo = String(body?.amedNo || '').trim()
  const unitName = String(body?.unitName || '').trim()
  if (!amedNo || !unitName) {
    return NextResponse.json({ error: 'กรุณาระบุ AmedNo และโรงพยาบาล' }, { status: 400 })
  }

  await connectDB()
  try {
    const created = await AmedDevice.create({
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
    return NextResponse.json({ data: JSON.parse(JSON.stringify(created)) }, { status: 201 })
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ error: 'มี AmedNo นี้ในหน่วยงานนี้อยู่แล้ว' }, { status: 409 })
    }
    return NextResponse.json({ error: 'ไม่สามารถเพิ่มรายการได้' }, { status: 500 })
  }
}
