import type { WorkOrderInput } from './workOrderTypes'
import { ATTACHMENT_LABEL, ATTACHMENT_MAX_BYTES, type AttachmentType, declaredTypeMatches, sniffAttachmentType } from './attachmentTypes'
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
    standardIds: optionalIds(v.standardIds, 'เครื่องมือมาตรฐาน'),
  }
}
/** รายการ id ที่ไม่บังคับ (ว่าง/ไม่ส่งมาได้) แต่ถ้าส่งมาต้องเป็น ObjectId และไม่ซ้ำ */
function optionalIds(value: unknown, label: string): string[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 500)
    throw new OrderError(`รายการ${label}ไม่ถูกต้อง`)
  const result = value.map(orderId)
  if (new Set(result).size !== result.length)
    throw new OrderError(`${label}ซ้ำกัน`)
  return result
}
/** คีย์ของเครื่องมือมาตรฐานใน record (std1 และ uc1–ucT) ที่ใช้ตรวจกับรายการของคำสั่ง */
export const RECORD_STANDARD_SLOTS = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
export function recordStandardNos(record: any): string[] {
  const nos = new Set<string>()
  const add = (v: unknown) => {
    const s = String(v ?? '').trim()
    if (s) nos.add(s)
  }
  add(record?.std1?.no)
  for (const slot of RECORD_STANDARD_SLOTS) add(record?.[slot]?.std?.no)
  return Array.from(nos)
}
/**
 * ถ้าคำสั่งระบุเครื่องมือมาตรฐานที่นำไป record ต้องใช้เฉพาะเครื่องมือเหล่านั้น
 * (คำสั่งที่ไม่ระบุ = ใช้ได้ทั้งทะเบียน)
 */
export function assertRecordStandardsAllowed(order: any, record: any) {
  const allowed = (order?.standards || []).map((s: any) => String(s?.no ?? '').trim()).filter(Boolean)
  if (!allowed.length) return
  const outside = recordStandardNos(record).filter((no) => !allowed.includes(no))
  if (outside.length)
    throw new OrderError(
      `เครื่องมือมาตรฐาน ${outside.join(', ')} ไม่อยู่ในรายการที่นำไปตามคำสั่ง ${order?.orderNo || ''}`.trim(),
      409
    )
}
/**
 * ตรวจไฟล์แนบคำสั่ง: PDF / PNG / JPEG ขนาดไม่เกิน 8 MB
 * ตรวจ magic bytes ของไฟล์และ MIME ที่ส่งมาต้องสอดคล้องกัน คืนชนิดไฟล์ที่ตรวจพบ
 */
export function validateOrderFile(
  file: { type: string; size: number },
  bytes: Uint8Array
): AttachmentType {
  if (file.size > ATTACHMENT_MAX_BYTES)
    throw new OrderError('ไฟล์ต้องไม่เกิน 8 MB', 413)
  const detected = file.size >= 5 ? sniffAttachmentType(bytes) : null
  if (!detected || !declaredTypeMatches(file.type, detected))
    throw new OrderError(`กรุณาเลือกไฟล์ ${ATTACHMENT_LABEL} ที่ถูกต้อง`)
  return detected
}
/** @deprecated ใช้ validateOrderFile (รับ PDF/PNG/JPEG) */
export const validateOrderPdf = validateOrderFile
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
