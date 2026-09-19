import { NextRequest } from 'next/server'
import { orderActor, orderResponse } from '@/lib/workOrderHttp'
import { getOrder, updateOrder, deleteOrder } from '@/lib/workOrderService'
type Context = { params: { id: string } }
export const GET = (_req: NextRequest, { params }: Context) =>
  orderResponse(async () => getOrder(await orderActor(), params.id))
export const PUT = (req: NextRequest, { params }: Context) =>
  orderResponse(async () =>
    updateOrder(await orderActor(), params.id, await req.json())
  )
export const DELETE = (_req: NextRequest, { params }: Context) =>
  orderResponse(async () => {
    await deleteOrder(await orderActor(), params.id)
    return { ok: true }
  })
