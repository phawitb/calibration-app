/** กฎความเป็นเจ้าของรายการ (TOR 1.2.1.15): เจ้าหน้าที่แก้ไขได้เฉพาะรายการของตนเอง ผู้ดูแลระบบไม่จำกัด */
export const OWNERSHIP_ERROR = 'แก้ไขได้เฉพาะรายการของตนเอง'

type SessionUserLike = { id?: string; username?: string; role?: string } | null | undefined
type RecordLike = { createdBy?: string | null; calibratedById?: string | null } | null | undefined

export function isRecordOwner(user: SessionUserLike, record: RecordLike) {
  if (!user || !record) return false
  const username = String(user.username || '').trim()
  const id = String(user.id || '').trim()
  if (username && String(record.createdBy || '').trim() === username) return true
  if (id && String(record.calibratedById || '').trim() === id) return true
  return false
}

/** true = แก้ไขได้ (admin เสมอ, technician เฉพาะของตนเอง, บทบาทอื่น false) */
export function canEditRecord(user: SessionUserLike, record: RecordLike) {
  const role = String(user?.role || '')
  if (role === 'admin') return true
  if (role === 'technician') return isRecordOwner(user, record)
  return false
}
