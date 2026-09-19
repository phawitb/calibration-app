import { NextRequest, NextResponse } from 'next/server'
import { orderActor, orderResponse, orderFailure } from '@/lib/workOrderHttp'
import { getOrder, requireOrderManager } from '@/lib/workOrderService'
import { OrderError, orderId } from '@/lib/workOrderValidation'
import { inlineContentDisposition } from '@/lib/contentDisposition'
import WorkOrderDocument from '@/models/WorkOrderDocument'
type Context = { params: { id: string; documentId: string } }
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const actor = await orderActor()
    await getOrder(actor, params.id)
    if (actor.role === 'hospital_user')
      throw new OrderError('ไม่มีสิทธิ์ดูเอกสารคำสั่ง', 403)
    const doc: any = await WorkOrderDocument.findOne({
      _id: orderId(params.documentId),
      orderId: params.id,
    }).select('+pdfData')
    if (!doc) throw new OrderError('ไม่พบไฟล์', 404)
    const disposition = inlineContentDisposition(doc.fileName)
    return new NextResponse(new Uint8Array(doc.pdfData), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': req.nextUrl.searchParams.has('download')
          ? disposition.replace(/^inline/, 'attachment')
          : disposition,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    return orderFailure(e)
  }
}
export const DELETE = (_req: NextRequest, { params }: Context) =>
  orderResponse(async () => {
    const actor = await orderActor()
    requireOrderManager(actor)
    await getOrder(actor, params.id)
    const doc = await WorkOrderDocument.findOneAndDelete({
      _id: orderId(params.documentId),
      orderId: params.id,
    })
    if (!doc) throw new OrderError('ไม่พบไฟล์', 404)
    return { ok: true }
  })
