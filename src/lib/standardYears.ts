import { STANDARD_DIVISOR_FIELDS, standardDivisorFields, standardComponentDivisors } from './formulaDivisors'
import { CORRECTION_FIELDS, getStandardCoefficients, hasPolynomialCorrection } from './standardCorrection'
export const STANDARD_FIELDS = ['no','name','manufacture','model','serialNo','certNo','measurement','unit','calDate','correction','correctionModel',...CORRECTION_FIELDS,...STANDARD_DIVISOR_FIELDS.map(c=>c.field),'uTStd','uTDrif','uTResStd','uTUuc','uTInt','uT6','uT7','uT8','uT9','uT10','expandedU'] as const
export const STANDARD_NUMBERS = ['correction',...CORRECTION_FIELDS,...STANDARD_DIVISOR_FIELDS.map(c=>c.field),'uTStd','uTDrif','uTResStd','uTUuc','uTInt','uT6','uT7','uT8','uT9','uT10','expandedU']
export const STANDARD_SLOTS = ['std1','uc1','uc2','uc3','uc4','uc5','uc6','ucT'] as const
export type StandardYear = { _id: any; instrumentRefId: string; year: number; revision: number; fields: Record<string, any>; calPoints: any[]; pdf?: any }
export class StandardYearError extends Error { constructor(message: string, public status = 400) { super(message) } }
export function normalizeStandardYear(value: unknown) {
  const input = Number(value)
  const year = input >= 2400 ? input - 543 : input
  if (!Number.isInteger(year) || year < 1900 || year > 2300) throw new StandardYearError('กรุณาระบุปี พ.ศ. หรือ ค.ศ. ที่ถูกต้อง')
  return year
}
export function standardSnapshot(version: StandardYear) {
  return { ...version.fields, instrumentRefId: version.instrumentRefId, referenceYear: version.year, referenceRevision: version.revision, referenceVersionId: String(version._id) }
}
export function latestStandardYears(versions: StandardYear[]) {
  const sorted = [...versions].sort((a,b) => b.year-a.year || b.revision-a.revision)
  const seen = new Set<string>()
  return sorted.filter(v => { const key = `${v.instrumentRefId}:${v.year}`; if (seen.has(key)) return false; seen.add(key); return true })
}
export function normalizeStandardFields(input: any) {
  const fields: Record<string, any> = {}
  for (const key of STANDARD_FIELDS) {
    const value = input?.[key]
    if (STANDARD_NUMBERS.includes(key)) {
      if (value === '' || value == null) continue
      const n = Number(value)
      if (!Number.isFinite(n)) throw new StandardYearError(`ค่า ${key} ต้องเป็นตัวเลข`)
      fields[key] = n
    } else fields[key] = String(value ?? '').trim()
  }
  if (hasPolynomialCorrection(input)) {
    let coefficients
    try { coefficients = getStandardCoefficients(input) } catch (error) { throw new StandardYearError((error as Error).message) }
    fields.correctionModel = 'polynomial-v1'
    CORRECTION_FIELDS.forEach((key, index) => { fields[key] = coefficients[(['a','b','c','d'] as const)[index]] })
    delete fields.correction
  }
  try { standardComponentDivisors(input); Object.assign(fields,standardDivisorFields(input)) } catch (error) { throw new StandardYearError((error as Error).message) }
  if (!fields.no || !fields.name) throw new StandardYearError('กรุณาระบุรหัสและชื่อเครื่องมือ')
  return fields
}
const equal = (a: any,b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const str = (v: any) => String(v ?? '').trim()
function legacyMatches(std: any, version: StandardYear) {
  const f = version.fields
  if (!str(std?.no) || str(std.no) !== str(f.no)) return false
  if (str(std.serialNo) && str(f.serialNo) && str(std.serialNo) !== str(f.serialNo)) return false
  return (str(std.certNo) && str(std.certNo) === str(f.certNo)) || (str(std.calDate) && str(std.calDate) === str(f.calDate))
}
function pointStandard(point: any, std: any, table: any) {
  if (table) {
    const index = (table.points || []).findIndex((p: any) => str(p.pointValue) === str(point))
    if (index < 0) throw new Error('จุดวัดเดิมไม่มีในตารางใหม่')
    const value = table.stdValues?.[index]
    if (value != null && value !== '') return value
  }
  if (str(std.measurement).toLowerCase() === 'time' || str(std.unit).toLowerCase() === 'h:mm:ss') return point
  const n = Number(point), correction = Number(std.correction || 0)
  if (!Number.isFinite(n) || !Number.isFinite(correction)) throw new Error('คำนวณค่า STD ของจุดเดิมไม่ได้')
  return n + correction
}
/** Only reference-derived STD values may change; measured UUC and manual STD values are retained. */
export function planStandardUpdate(record: any, target: StandardYear, versions: StandardYear[]) {
  const patch: Record<string, any> = {}
  const changes: string[] = [], warnings: string[] = []
  let matched = false
  for (const slot of STANDARD_SLOTS) {
    const std = slot === 'std1' ? record[slot] : record[slot]?.std
    if (!std?.no) continue
    let source: StandardYear | undefined
    if (std.instrumentRefId) {
      if (str(std.instrumentRefId) !== str(target.instrumentRefId) || Number(std.referenceYear) !== target.year) continue
      matched = true
      if (str(std.referenceVersionId) === str(target._id)) continue
      source = versions.find(v => str(v._id) === str(std.referenceVersionId))
      if (!source) { warnings.push(`${slot}: ไม่พบรุ่นข้อมูลเดิมที่อ้างอิง`); continue }
    } else {
      const candidates = versions.filter(v => legacyMatches(std,v))
      const years = Array.from(new Set(candidates.map(v => v.year)))
      if (!years.includes(target.year)) {
        if (!years.length && versions.some(v => str(v.fields.no) === str(std.no))) {
          matched = true
          warnings.push(`${slot}: ไม่ทราบปีที่ใช้จากข้อมูลเดิม ต้องตรวจสอบก่อนอัปเดต`)
        }
        continue
      }
      matched = true
      if (years.length !== 1) { warnings.push(`${slot}: ข้อมูลเดิมตรงกับหลายปี ต้องตรวจสอบปีที่ใช้`); continue }
      source = candidates.find(v => STANDARD_FIELDS.every(k => std[k] == null || std[k] === '' || str(std[k]) === str(v.fields[k])))
      if (!source) { warnings.push(`${slot}: ค่ามาตรฐานเดิมไม่ตรงกับรุ่นที่เก็บไว้ ต้องตรวจสอบ`); continue }
    }
    const nextStd = { ...std }
    for (const key of STANDARD_FIELDS) delete nextStd[key]
    Object.assign(nextStd, standardSnapshot(target))
    const changedFields = STANDARD_FIELDS.filter(k => str(std[k]) !== str(nextStd[k]))
    changes.push(`${slot}: ${changedFields.length ? changedFields.join(', ') : 'รุ่นข้อมูล/PDF'}`)
    if (hasPolynomialCorrection(nextStd)) {
      try { getStandardCoefficients(nextStd) } catch (error) { warnings.push(`${slot}: ${(error as Error).message}`) }
    }
    if (slot === 'std1') {
      if (!hasPolynomialCorrection(std) && record.calibrationType === 'iso' && str(source.fields.correction) !== str(target.fields.correction)) warnings.push('std1: ค่า correction ของ ISO ต้องตรวจสอบค่าชดเชยรายจุดก่อนอัปเดต')
      patch.std1 = nextStd; continue
    }
    const uc = record[slot]
    if (hasPolynomialCorrection(std) && hasPolynomialCorrection(nextStd)) {
      try { getStandardCoefficients(nextStd) } catch (error) { warnings.push(`${slot}: ${(error as Error).message}`) }
      // Polynomial records store actual raw STD reads; only the coefficient snapshot changes.
      patch[slot] = { ...uc, std: nextStd }
      continue
    }
    const sourceTable = source.calPoints?.find(t => str(t._id) === str(uc.calibrationTableId))
    const targetTable = target.calPoints?.find(t => str(t._id) === str(uc.calibrationTableId))
    const standardChanged = str(source.fields.correction) !== str(target.fields.correction) || !equal(source.calPoints,target.calPoints)
    const points = (uc.calPoints || []).map((p: any) => {
      if (!standardChanged) return p
      if (!Array.isArray(p.standards) || p.standards.every((v: any) => v === '' || v == null)) return p
      if (!Array.isArray(p.referenceStandards) || !equal(p.standards,p.referenceStandards) || str(p.referencePoint) !== str(p.point)) {
        // Legacy records cannot establish whether STD readings were measured or auto-filled.
        warnings.push(`${slot}: ค่า STD ที่จุด ${p.point} ต้องตรวจสอบก่อนอัปเดต`)
        return p
      }
      if (uc.calibrationTableId && (!sourceTable || !targetTable)) { warnings.push(`${slot}: ตารางจุดสอบเทียบถูกลบหรือไม่พบ`); return p }
      try {
        const value = pointStandard(p.point,target.fields,targetTable)
        const standards = p.standards.map(() => value)
        return { ...p, standards, referenceStandards: [...standards], referencePoint: p.point }
      } catch (error) { warnings.push(`${slot}: ${(error as Error).message}`); return p }
    })
    patch[slot] = { ...uc, std: nextStd, calPoints: points }
  }
  return { matched, patch, changes, reason: Array.from(new Set(warnings)).join('; '), status: warnings.length ? 'manual' as const : 'ready' as const }
}
