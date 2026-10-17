import bcrypt from 'bcryptjs'
import User from '@/models/User'

export const PIN_PATTERN = /^\d{4,8}$/
export const PIN_NOT_SET_ERROR = 'ยังไม่ได้ตั้ง PIN กรุณาตั้งรหัสยืนยันส่งอนุมัติที่หน้า "โปรไฟล์ของฉัน" ก่อน'
export const PIN_INVALID_ERROR = 'PIN ไม่ถูกต้อง'

export type PinCheck = { ok: true } | { ok: false; status: 400 | 403 | 409; error: string }

/**
 * ตรวจ PIN ของผู้ใช้ใน session (ทุกบทบาทรวมถึง admin ต้องใส่ PIN ไม่มีข้อยกเว้น)
 * ต้องเรียกหลัง connectDB()
 */
export async function verifyApprovalPin(sessionUserId: unknown, pinRaw: unknown): Promise<PinCheck> {
  const pin = String(pinRaw ?? '').trim()
  if (!pin) return { ok: false, status: 400, error: 'กรุณากรอก PIN เพื่อยืนยันการส่งขออนุมัติ' }
  const id = String(sessionUserId || '')
  if (!id) return { ok: false, status: 403, error: PIN_INVALID_ERROR }
  const user = await User.findById(id).select('+approvalPinHash').lean<{ approvalPinHash?: string } | null>()
  if (!user) return { ok: false, status: 403, error: PIN_INVALID_ERROR }
  if (!user.approvalPinHash) return { ok: false, status: 409, error: PIN_NOT_SET_ERROR }
  if (!PIN_PATTERN.test(pin)) return { ok: false, status: 403, error: PIN_INVALID_ERROR }
  const match = await bcrypt.compare(pin, user.approvalPinHash)
  if (!match) return { ok: false, status: 403, error: PIN_INVALID_ERROR }
  return { ok: true }
}
