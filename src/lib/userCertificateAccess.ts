import mongoose from 'mongoose'
import CalibrationRecord from '@/models/CalibrationRecord'
import { resolveHospitalScope } from '@/lib/hospitalScope'

/**
 * ใครดูใบรับรองบุคลากร (เอกสารรับรองของเจ้าหน้าที่) ของ userId ได้บ้าง
 * - admin / technician / approver: ดูได้ทุกคน
 * - เจ้าของบัญชี: ดูของตนเอง
 * - hospital_user: ดูได้เฉพาะเจ้าหน้าที่ที่เคยสอบเทียบ/อนุมัติเครื่องมือของโรงพยาบาลตน
 */
export async function canViewUserCertificates(sessionUser: unknown, targetUserId: string): Promise<boolean> {
  const u = (sessionUser || {}) as { id?: string; role?: string }
  if (!mongoose.isValidObjectId(targetUserId)) return false
  if (u.role === 'admin' || u.role === 'technician' || u.role === 'approver') return true
  if (u.id && String(u.id) === String(targetUserId)) return true
  if (u.role !== 'hospital_user') return false

  const scope = await resolveHospitalScope(sessionUser)
  if (scope.kind !== 'units') return false
  const linked = await CalibrationRecord.exists({
    unitName: { $in: scope.units },
    $or: [{ calibratedById: targetUserId }, { approvedById: targetUserId }],
  })
  return !!linked
}
