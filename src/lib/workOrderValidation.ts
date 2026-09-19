import type { WorkOrderInput } from './workOrderTypes'
export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}
export const canManageOrders = (role?: string) =>
  role === 'admin' || role === 'technician'
export function orderId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value))
    throw new OrderError('รหัสรายการไม่ถูกต้อง')
  return value.toLowerCase()
}
function required(value: unknown, label: string, max = 250) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new OrderError(`กรุณาระบุ${label} (ไม่เกิน ${max} ตัวอักษร)`)
  return value.trim()
}
function ids(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 10000)
    throw new OrderError(`กรุณาเลือก${label}`)
  const result = value.map(orderId)
  if (new Set(result).size !== result.length)
    throw new OrderError(`${label}ซ้ำกัน`)
  return result
}
export function validateWorkOrderInput(value: unknown): WorkOrderInput {
  const v = value as any
  if (!v || typeof v !== 'object')
    throw new OrderError('ข้อมูลคำสั่งไม่ถูกต้อง')
  const orderNo = required(v.orderNo, 'เลขที่คำสั่ง', 100),
    title = required(v.title, 'ชื่อเรื่อง')
  const dates = [v.startDate, v.endDate].map((x) => {
    if (
      typeof x !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(x) ||
      !Number.isFinite(Date.parse(x)) ||
      new Date(x).toISOString().slice(0, 10) !== x
    )
      throw new OrderError('วันที่ไม่ถูกต้อง')
    return x
  })
  if (dates[1] < dates[0])
    throw new OrderError('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม')
  if (
    !Array.isArray(v.hospitals) ||
    !v.hospitals.length ||
    v.hospitals.length > 500
  )
    throw new OrderError('กรุณาเลือกโรงพยาบาล')
  const hospitals = v.hospitals.map((h: any) => ({
    unitName: required(h?.unitName, 'โรงพยาบาล', 500),
    deviceIds: ids(h?.deviceIds, 'เครื่องมือ'),
  }))
  if (new Set(hospitals.map((h: any) => h.unitName)).size !== hospitals.length)
    throw new OrderError('โรงพยาบาลซ้ำกัน')
  const all = hospitals.flatMap((h: any) => h.deviceIds)
  if (new Set(all).size !== all.length) throw new OrderError('เครื่องมือซ้ำกัน')
  return {
    orderNo,
    title,
    startDate: dates[0],
    endDate: dates[1],
    notes: typeof v.notes === 'string' ? v.notes.slice(0, 5000).trim() : '',
    hospitals,
    memberIds: ids(v.memberIds, 'ทีมผู้ปฏิบัติงาน'),
  }
}
export function validateOrderPdf(
  file: { type: string; size: number },
  bytes: Uint8Array
) {
  if (file.size > 8 * 1024 * 1024)
    throw new OrderError('ไฟล์ต้องไม่เกิน 8 MB', 413)
  if (
    file.type !== 'application/pdf' ||
    file.size < 5 ||
    String.fromCharCode(...Array.from(bytes.slice(0, 5))) !== '%PDF-'
  )
    throw new OrderError('กรุณาเลือกไฟล์ PDF ที่ถูกต้อง')
}
export function assertRecordOrderIdentity(existing: any, patch: any) {
  const fields = existing.workOrderId
    ? [
        'workOrderId',
        'workOrderDeviceId',
        'unitName',
        'amedNo',
        'serialNo',
        'deviceName',
        'brand',
        'model',
      ]
    : ['workOrderId', 'workOrderDeviceId']
  for (const key of fields)
    if (
      key in patch &&
      String(patch[key] ?? '') !== String(existing[key] ?? '')
    )
      throw new OrderError(
        'ไม่สามารถเปลี่ยนคำสั่งหรือเครื่องมือของงานที่สร้างแล้ว',
        409
      )
}
export function projectOrderForHospital(order: any, variants: string[]) {
  const hospitals = order.hospitals.filter((h: any) =>
    variants.includes(h.unitName)
  )
  if (!hospitals.length) return null
  return {
    ...order,
    hospitals,
    devices: (order.devices || []).filter((d: any) =>
      variants.includes(d.unitName)
    ),
  }
}
