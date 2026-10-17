import { getUnitVariants } from '@/lib/unitVariants'

export type HospitalScope =
  | { kind: 'all' }
  | { kind: 'units'; units: string[] }
  | { kind: 'forbidden'; reason: string }

/**
 * ขอบเขตโรงพยาบาลที่ผู้ใช้เห็นได้
 * - บทบาทอื่น: เห็นทั้งหมด
 * - hospital_user: เห็นเฉพาะหน่วยของตน ถ้าบัญชีไม่ได้ผูกหน่วยงานไว้ จะไม่เห็นอะไรเลย
 */
export async function resolveHospitalScope(sessionUser: unknown): Promise<HospitalScope> {
  const u = (sessionUser || {}) as { role?: string; hospitalUnit?: string }
  if (u.role !== 'hospital_user') return { kind: 'all' }
  const unit = String(u.hospitalUnit || '').trim()
  if (!unit) {
    return { kind: 'forbidden', reason: 'บัญชีผู้ใช้โรงพยาบาลยังไม่ได้ผูกหน่วยงาน กรุณาติดต่อผู้ดูแลระบบ' }
  }
  const units = await getUnitVariants(unit)
  if (!units.length) return { kind: 'forbidden', reason: 'ไม่พบหน่วยงานของผู้ใช้' }
  return { kind: 'units', units }
}

/** true ถ้าผู้ใช้เห็น record ที่มี unitName นี้ได้ */
export function scopeAllows(scope: HospitalScope, unitName: unknown): boolean {
  if (scope.kind === 'all') return true
  if (scope.kind === 'forbidden') return false
  return scope.units.includes(String(unitName || ''))
}
