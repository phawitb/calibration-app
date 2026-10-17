import mongoose from 'mongoose'
import CalibrationRecord from '@/models/CalibrationRecord'
import { resolveHospitalScope, scopeAllows } from '@/lib/hospitalScope'
import { canEditRecord, OWNERSHIP_ERROR } from '@/lib/recordOwnership'

export type AttachmentRecord = {
  _id: mongoose.Types.ObjectId
  unitName?: string
  createdBy?: string
  calibratedById?: string
  certNo?: string
  amedNo?: string
  deviceName?: string
}

export type AttachmentAccess =
  | { ok: true; record: AttachmentRecord }
  | { ok: false; status: 400 | 403 | 404; error: string }

/**
 * สิทธิ์ไฟล์แนบของ record
 * - ดู: admin / technician / approver ทุกรายการ, hospital_user เฉพาะหน่วยในขอบเขตของตน
 * - อัปโหลด/ลบ: admin ทุกรายการ, technician เฉพาะรายการของตนเอง
 * ต้องเรียกหลัง connectDB()
 */
export async function resolveAttachmentAccess(
  sessionUser: unknown,
  recordId: string,
  mode: 'view' | 'write',
): Promise<AttachmentAccess> {
  if (!mongoose.isValidObjectId(recordId)) return { ok: false, status: 404, error: 'Not found' }
  const record = await CalibrationRecord.findById(recordId)
    .select('unitName createdBy calibratedById certNo amedNo deviceName')
    .lean<AttachmentRecord | null>()
  if (!record) return { ok: false, status: 404, error: 'Not found' }

  const user = (sessionUser || {}) as { role?: string; id?: string; username?: string }
  if (mode === 'write') {
    if (user.role !== 'admin' && user.role !== 'technician') return { ok: false, status: 403, error: 'Forbidden' }
    if (!canEditRecord(user, record)) return { ok: false, status: 403, error: OWNERSHIP_ERROR }
    return { ok: true, record }
  }

  const scope = await resolveHospitalScope(user)
  if (!scopeAllows(scope, record.unitName)) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true, record }
}
