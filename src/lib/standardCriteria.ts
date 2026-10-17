import { StandardYearError } from './standardYears'

/** เกณฑ์การยอมรับของเครื่องมือมาตรฐาน (TOR 1.4.4.1) */
export type AcceptanceCriteria = { maxCorrection?: number; maxUncertainty?: number; note?: string }
/** ฟิลด์ทะเบียนระดับ root ของ stdinstrumentrefs (TOR 1.1.1.3, 1.1.1.7, 1.1.1.8) */
export type StandardRegistryFields = {
  calIntervalMonths?: number | null
  nextCalDate?: string | null
  /** true เมื่อระบบคำนวณ nextCalDate ให้เอง (จะคำนวณใหม่เมื่อบันทึกปีถัดไป) */
  nextCalDateAuto?: boolean
  calibratedBy?: string
  acceptanceCriteria?: AcceptanceCriteria | null
}
export const STANDARD_REGISTRY_KEYS = ['calIntervalMonths', 'nextCalDate', 'nextCalDateAuto', 'calibratedBy', 'acceptanceCriteria'] as const
export type CriteriaResult = { pass: boolean; failures: string[] }
export type StandardDueStatus = 'overdue' | 'expiringSoon' | 'ok'

const isoDate = (value: unknown) => {
  const text = String(value ?? '').trim()
  if (!text) return ''
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) throw new StandardYearError('วันที่ครบกำหนดสอบเทียบไม่ถูกต้อง')
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : date.toISOString().slice(0, 10)
}
const optionalNumber = (value: unknown, label: string, { integer = false, min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new StandardYearError(`${label}ไม่ถูกต้อง`)
  return n
}

/** ตรวจสอบและแปลงฟิลด์ทะเบียนที่ส่งมาจากฟอร์ม/CSV (คืนเฉพาะคีย์ที่มีใน input) */
export function normalizeStandardRegistryFields(input: any): StandardRegistryFields {
  const out: StandardRegistryFields = {}
  if (!input || typeof input !== 'object') return out
  if ('calIntervalMonths' in input) out.calIntervalMonths = optionalNumber(input.calIntervalMonths, 'ความถี่ในการสอบเทียบ (เดือน)', { integer: true, min: 1, max: 600 })
  if ('nextCalDate' in input) out.nextCalDate = isoDate(input.nextCalDate) || null
  if ('calibratedBy' in input) {
    const text = String(input.calibratedBy ?? '').trim()
    if (text.length > 250) throw new StandardYearError('หน่วยงานที่สอบเทียบต้องไม่เกิน 250 ตัวอักษร')
    out.calibratedBy = text
  }
  if ('acceptanceCriteria' in input) {
    let raw = input.acceptanceCriteria
    if (typeof raw === 'string' && raw.trim().startsWith('{')) {
      try { raw = JSON.parse(raw) } catch { throw new StandardYearError('รูปแบบเกณฑ์การยอมรับไม่ถูกต้อง') }
    }
    if (raw == null || raw === '') out.acceptanceCriteria = null
    else {
      if (typeof raw !== 'object' || Array.isArray(raw)) throw new StandardYearError('รูปแบบเกณฑ์การยอมรับไม่ถูกต้อง')
      const criteria: AcceptanceCriteria = {}
      const maxCorrection = optionalNumber(raw.maxCorrection, 'เกณฑ์ค่าแก้สูงสุด')
      const maxUncertainty = optionalNumber(raw.maxUncertainty, 'เกณฑ์ค่าความไม่แน่นอนสูงสุด')
      if (maxCorrection != null) criteria.maxCorrection = maxCorrection
      if (maxUncertainty != null) criteria.maxUncertainty = maxUncertainty
      const note = String(raw.note ?? '').trim()
      if (note.length > 1000) throw new StandardYearError('หมายเหตุเกณฑ์การยอมรับต้องไม่เกิน 1000 ตัวอักษร')
      if (note) criteria.note = note
      out.acceptanceCriteria = Object.keys(criteria).length ? criteria : null
    }
  }
  return out
}

/** วันที่ครบกำหนดถัดไป = calDate + calIntervalMonths (คืน ISO yyyy-mm-dd หรือ null ถ้าคำนวณไม่ได้) */
export function computeNextCalDate(calDate: unknown, intervalMonths: unknown): string | null {
  const months = Number(intervalMonths)
  const text = String(calDate ?? '').trim()
  if (!text || !Number.isInteger(months) || months <= 0) return null
  const base = new Date(text)
  if (Number.isNaN(base.getTime())) return null
  const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(base.getUTCDate(), lastDay))
  return next.toISOString().slice(0, 10)
}

const hasCriteria = (criteria: AcceptanceCriteria | null | undefined) =>
  !!criteria && (Number.isFinite(Number(criteria.maxCorrection)) && criteria.maxCorrection != null || Number.isFinite(Number(criteria.maxUncertainty)) && criteria.maxUncertainty != null)

/**
 * เปรียบเทียบค่าแก้ (correction) และค่าความไม่แน่นอน (expandedU) ของรุ่นข้อมูลกับเกณฑ์การยอมรับ
 * - ค่าแก้ต่อจุด = ค่า STD − จุดสอบเทียบ (เมื่อมีตารางและค่า STD) มิฉะนั้นใช้ correction / D ของสมการ
 * - ถ้าไม่มีเกณฑ์ถือว่าผ่าน (ไม่มีอะไรให้เทียบ)
 */
export function evaluateStandardAgainstCriteria(
  version: { fields?: Record<string, any>; calPoints?: any[] } | null | undefined,
  criteria: AcceptanceCriteria | null | undefined,
): CriteriaResult {
  const failures: string[] = []
  if (!version || !hasCriteria(criteria)) return { pass: true, failures }
  const fields = version.fields || {}
  const maxCorrection = criteria?.maxCorrection != null ? Math.abs(Number(criteria.maxCorrection)) : null
  const maxUncertainty = criteria?.maxUncertainty != null ? Math.abs(Number(criteria.maxUncertainty)) : null
  const fmt = (n: number) => Number(n.toPrecision(6)).toString()

  if (maxCorrection != null) {
    let pointChecked = false
    for (const table of version.calPoints || []) {
      const points = Array.isArray(table?.points) ? table.points : []
      points.forEach((point: any, index: number) => {
        const std = table.stdValues?.[index]
        const p = Number(point?.pointValue), s = Number(std)
        if (std == null || std === '' || !Number.isFinite(p) || !Number.isFinite(s)) return
        pointChecked = true
        const correction = s - p
        if (Math.abs(correction) > maxCorrection)
          failures.push(`จุด ${point.pointValue}${point.unit ? ` ${point.unit}` : ''}: ค่าแก้ ${fmt(correction)} เกินเกณฑ์ ±${fmt(maxCorrection)}`)
      })
    }
    if (!pointChecked) {
      const global = fields.correctionModel === 'polynomial-v1' ? fields.correctionD : fields.correction
      const c = Number(global)
      if (global != null && global !== '' && Number.isFinite(c) && Math.abs(c) > maxCorrection)
        failures.push(`ค่าแก้ ${fmt(c)} เกินเกณฑ์ ±${fmt(maxCorrection)}`)
    }
  }
  if (maxUncertainty != null) {
    const u = Number(fields.expandedU)
    if (fields.expandedU != null && fields.expandedU !== '' && Number.isFinite(u) && Math.abs(u) > maxUncertainty)
      failures.push(`ค่าความไม่แน่นอน (expandedU) ${fmt(u)} เกินเกณฑ์ ${fmt(maxUncertainty)}`)
  }
  return { pass: failures.length === 0, failures }
}

/** วันครบกำหนดของเครื่องมือ: nextCalDate ของทะเบียน หรือวันหมดอายุ PDF ของปีล่าสุด */
export function standardDueDate(root: { nextCalDate?: unknown } | null | undefined, latestVersion?: { pdf?: { expiryDate?: unknown } } | null) {
  const own = String(root?.nextCalDate ?? '').trim()
  if (own && !Number.isNaN(new Date(own).getTime())) return own.slice(0, 10)
  const pdf = String(latestVersion?.pdf?.expiryDate ?? '').trim()
  if (pdf && !Number.isNaN(new Date(pdf).getTime())) return new Date(pdf).toISOString().slice(0, 10)
  return null
}

/** สถานะครบกำหนดเทียบกับวันนี้และจำนวนวันแจ้งเตือนล่วงหน้า */
export function standardDueStatus(dueDate: string | null | undefined, alertBeforeDays: number, now = new Date()): StandardDueStatus | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dueDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()))
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'overdue'
  if (days <= Math.max(0, alertBeforeDays)) return 'expiringSoon'
  return 'ok'
}
