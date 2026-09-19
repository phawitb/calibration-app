import { NextRequest } from 'next/server'
import { orderActor, orderResponse } from '@/lib/workOrderHttp'
import { listOrders, createOrder } from '@/lib/workOrderService'
export const GET = () =>
  orderResponse(async () => listOrders(await orderActor()))
export const POST = (req: NextRequest) =>
  orderResponse(
    async () => createOrder(await orderActor(), await req.json()),
    201
  )
