import CalibrationRecord from '@/models/CalibrationRecord'
import CertNumberConfig from '@/models/CertNumberConfig'

function twoDigitYear(dateInput?: unknown): string {
  const d = dateInput ? new Date(String(dateInput)) : new Date()
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return String(now.getFullYear() % 100).padStart(2, '0')
  }
  return String(d.getFullYear() % 100).padStart(2, '0')
}

function fourDigitYear(dateInput?: unknown): string {
  const d = dateInput ? new Date(String(dateInput)) : new Date()
  if (Number.isNaN(d.getTime())) return String(new Date().getFullYear())
  return String(d.getFullYear())
}

function patternToRegex(pattern: string, yy: string, yyyy: string, resetByYear: boolean) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const withNum = escaped.replace('\\{num\\}', '(\\d+)')
  const withYy = withNum.replace('\\{yy\\}', resetByYear ? yy : '(\\d{2})')
  const withYyyy = withYy.replace('\\{yyyy\\}', resetByYear ? yyyy : '(\\d{4})')
  return new RegExp(`^${withYyyy}$`)
}

function renderPattern(pattern: string, n: number, padding: number, yy: string, yyyy: string) {
  const num = String(n).padStart(padding, '0')
  return pattern
    .replace('{num}', num)
    .replace('{yy}', yy)
    .replace('{yyyy}', yyyy)
}

/**
 * รันเลขที่ใบรับรองรูปแบบ NNN/YY เช่น 003/69
 */
export async function generateNextCertNo(dateInput?: unknown): Promise<string> {
  const yy = twoDigitYear(dateInput)
  const yyyy = fourDigitYear(dateInput)

  const cfg = await CertNumberConfig.findOne({ key: 'default' })
    .select('pattern startNumber padding resetByYear')
    .lean()
  const c: any = cfg || null

  const pattern = String(c?.pattern || '{num}/{yy}')
  const startNumber = Number.isFinite(Number(c?.startNumber)) ? Number(c?.startNumber) : 1
  const padding = Number.isFinite(Number(c?.padding)) ? Number(c?.padding) : 3
  const resetByYear = c?.resetByYear !== undefined ? !!c.resetByYear : true

  const regex = patternToRegex(pattern, yy, yyyy, resetByYear)
  const rows = await CalibrationRecord.find({})
    .select('certNo')
    .lean()

  let maxNo = startNumber - 1
  for (const r of rows as any[]) {
    const cert = String(r?.certNo || '').trim()
    const m = cert.match(regex)
    if (!m) continue
    const n = Number(m[1] || 0)
    if (Number.isFinite(n) && n > maxNo) maxNo = n
  }
  return renderPattern(pattern, maxNo + 1, padding, yy, yyyy)
}
