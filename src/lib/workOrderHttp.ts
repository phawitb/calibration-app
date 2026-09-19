import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import { connectDB } from './mongodb'
import { OrderError } from './workOrderValidation'
import type { OrderActor } from './workOrderService'
export async function orderActor(): Promise<OrderActor> {
  const s = await getServerSession(authOptions)
  if (!s?.user) throw new OrderError('กรุณาเข้าสู่ระบบ', 401)
  await connectDB()
  return s.user as OrderActor
}
export async function orderResponse(
  action: () => Promise<unknown>,
  status = 200
) {
  try {
    return NextResponse.json({ data: await action() }, { status })
  } catch (e) {
    return orderFailure(e)
  }
}
export function orderFailure(e: unknown) {
  if (e instanceof OrderError)
    return NextResponse.json({ error: e.message }, { status: e.status })
  if (e instanceof SyntaxError)
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 })
  console.error('Work order operation failed', e)
  return NextResponse.json(
    { error: 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่' },
    { status: 500 }
  )
}
