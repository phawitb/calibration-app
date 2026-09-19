export const AMED_UC_KEYS = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
export type AmedUcKey = typeof AMED_UC_KEYS[number]
export type AmedUcValues = Partial<Record<AmedUcKey, string | string[]>>

/** Standard numbers are identifiers; preserve leading zeros and configured order. */
export function normalizeUcOptions(value: unknown): string[] {
  if (value == null || value === '') return []
  let parsed = value
  if (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
    parsed = JSON.parse(parsed)
  }
  const values = Array.isArray(parsed) ? parsed : [parsed]
  if (values.some(v => typeof v !== 'string' && typeof v !== 'number')) {
    throw new Error('ค่า UC ต้องเป็นรหัสหรือรายการรหัสเครื่องมือมาตรฐาน')
  }
  return Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean)))
}

export function normalizeAmedUcFields<T extends Record<string, any>>(data: T): T {
  const normalized = { ...data }
  for (const key of AMED_UC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      (normalized as Record<string, unknown>)[key] = normalizeUcOptions(data[key])
    }
  }
  return normalized
}

export function buildAmedUcDefaults(device: AmedUcValues, selections: Partial<Record<AmedUcKey, string>> = {}) {
  const defaults: Partial<Record<AmedUcKey, { std: { no: string }; calPoints: never[] }>> = {}
  for (const key of AMED_UC_KEYS) {
    const options = normalizeUcOptions(device[key])
    const selected = selections[key] ?? options[0]
    if (selected && !options.includes(selected)) throw new Error(`รหัส ${key} ไม่อยู่ในทะเบียน`)
    if (selected) defaults[key] = { std: { no: selected }, calPoints: [] }
  }
  return defaults
}
