/**
 * เกณฑ์การยอมรับ (Maximum Permissible Error) และการตัดสินผล ผ่าน/ไม่ผ่าน/N/A ต่อจุดสอบเทียบ
 * TOR 1.2.1.13, 1.4.4.2
 */

export type Verdict = 'pass' | 'fail' | 'na'
export type MpeUnit = 'abs' | 'percent'

export interface AcceptanceCriteria {
  /** ค่าคลาดเคลื่อนสูงสุดที่ยอมรับได้ (หน่วยเดียวกับค่าวัด หรือ % ของค่าอ้างอิง) */
  mpe?: number | string | null
  mpeUnit?: MpeUnit | string | null
  /** รวมค่าความไม่แน่นอนขยาย U เข้ากับค่าคลาดเคลื่อนก่อนเทียบเกณฑ์ */
  includeUncertainty?: boolean | null
  note?: string | null
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  na: 'N/A',
}

export const VERDICTS: Verdict[] = ['pass', 'fail', 'na']

export function isVerdict(value: unknown): value is Verdict {
  return value === 'pass' || value === 'fail' || value === 'na'
}

export function normalizeMpeUnit(unit: unknown): MpeUnit {
  const text = String(unit ?? '').trim().toLowerCase()
  return text === 'percent' || text === '%' ? 'percent' : 'abs'
}

function toFinite(value: unknown): number | null {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * ค่าเกณฑ์ที่ใช้เทียบจริง (หน่วยค่าวัด)
 * - abs: ใช้ mpe ตรง ๆ
 * - percent: mpe% ของค่าอ้างอิง (reference) ต้องมีค่าอ้างอิงที่เป็นตัวเลข
 */
export function resolveMpeLimit(acceptance: AcceptanceCriteria | null | undefined, reference?: number | null): number | null {
  const mpe = toFinite(acceptance?.mpe)
  if (mpe == null || mpe < 0) return null
  if (normalizeMpeUnit(acceptance?.mpeUnit) === 'percent') {
    const ref = toFinite(reference)
    if (ref == null) return null
    return Math.abs(ref) * mpe / 100
  }
  return mpe
}

/**
 * ตัดสินผลหนึ่งจุด
 * - na เมื่อไม่มี MPE หรือค่าคลาดเคลื่อน/ค่าอ้างอิงไม่ใช่ตัวเลข (หรือ U ไม่ใช่ตัวเลขเมื่อต้องรวม U)
 * - fail เมื่อ |error| (+U ถ้า includeUncertainty) > เกณฑ์
 * - ผ่าน นอกจากนั้น
 */
export function evaluatePoint(
  error: unknown,
  expandedU: unknown,
  acceptance: AcceptanceCriteria | null | undefined,
  reference?: unknown,
): Verdict {
  const err = toFinite(error)
  if (err == null) return 'na'
  const limit = resolveMpeLimit(acceptance, toFinite(reference))
  if (limit == null) return 'na'
  let magnitude = Math.abs(err)
  if (acceptance?.includeUncertainty) {
    const u = toFinite(expandedU)
    if (u == null) return 'na'
    magnitude += Math.abs(u)
  }
  return magnitude > limit ? 'fail' : 'pass'
}

/** ผลรวมของทุกจุด: มีไม่ผ่านแม้จุดเดียว = ไม่ผ่าน, ไม่มีจุดที่ตัดสินได้ = N/A, นอกนั้น = ผ่าน */
export function summarizeVerdicts(points: ReadonlyArray<Verdict | { verdict?: Verdict | null } | null | undefined>): Verdict {
  let decided = false
  for (const item of points) {
    const v = typeof item === 'string' ? item : item?.verdict
    if (v === 'fail') return 'fail'
    if (v === 'pass') decided = true
  }
  return decided ? 'pass' : 'na'
}

/** ข้อความเกณฑ์สำหรับแสดงในใบรับรอง เช่น "MPE ± 0.5 °C (รวม U)" */
export function describeAcceptance(acceptance: AcceptanceCriteria | null | undefined, unit?: string): string {
  const mpe = toFinite(acceptance?.mpe)
  if (mpe == null) return ''
  const isPercent = normalizeMpeUnit(acceptance?.mpeUnit) === 'percent'
  const unitText = isPercent ? '%' : (unit ? ` ${unit}` : '')
  const parts = [`MPE ± ${mpe}${unitText}`]
  if (acceptance?.includeUncertainty) parts.push('(รวม U)')
  const note = String(acceptance?.note || '').trim()
  if (note) parts.push(`- ${note}`)
  return parts.join(' ')
}
