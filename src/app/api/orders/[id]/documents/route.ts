import { NextRequest } from 'next/server'
import { orderActor, orderResponse } from '@/lib/workOrderHttp'
import { getOrder, requireOrderManager } from '@/lib/workOrderService'
import { OrderError, validateOrderPdf } from '@/lib/workOrderValidation'
import WorkOrderDocument from '@/models/WorkOrderDocument'
import WorkOrder from '@/models/WorkOrder'
type Context = { params: { id: string } }
export const GET = (_req: NextRequest, { params }: Context) =>
  orderResponse(async () => {
    const actor = await orderActor()
    await getOrder(actor, params.id)
    if (actor.role === 'hospital_user')
      throw new OrderError('ไม่มีสิทธิ์ดูเอกสารคำสั่ง', 403)
    return WorkOrderDocument.find({ orderId: params.id })
      .sort({ uploadedAt: -1 })
      .lean()
  })
export const POST = (req: NextRequest, { params }: Context) =>
  orderResponse(async () => {
    const actor = await orderActor()
    requireOrderManager(actor)
    await getOrder(actor, params.id)
    const form = await req.formData(),
      file = form.get('file')
    if (!file || typeof file === 'string')
      throw new OrderError('กรุณาเลือกไฟล์ PDF')
    if (file.size > 8 * 1024 * 1024)
      throw new OrderError('ไฟล์ต้องไม่เกิน 8 MB', 413)
    const bytes = Buffer.from(await file.arrayBuffer())
    validateOrderPdf(file, bytes)
    const saved = await WorkOrderDocument.create({
      orderId: params.id,
      fileName: file.name.slice(0, 250),
      contentType: 'application/pdf',
      pdfData: bytes,
      size: file.size,
      uploadedBy: actor.id,
    })
    if (!(await WorkOrder.exists({ _id: params.id }))) {
      await WorkOrderDocument.deleteOne({ _id: saved._id })
      throw new OrderError('คำสั่งถูกลบแล้ว', 404)
    }
    return {
      _id: saved._id,
      fileName: saved.fileName,
      size: saved.size,
      uploadedAt: saved.uploadedAt,
    }
  }, 201)
