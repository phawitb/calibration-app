/**
 * ตรวจสภาวะแวดล้อม (อุณหภูมิ/ความชื้น) ก่อนส่งขออนุมัติและก่อนอนุมัติใบรับรอง
 * TOR 1.2.2.3, 1.2.2.4 — ไฟล์นี้ไม่พึ่งพา Mongoose จึงใช้ได้ทั้งฝั่ง client และ server
 */

export interface EnvironmentConfig {
  requireEnvironment?: boolean | null
  envTempMin?: number | null
  envTempMax?: number | null
  envHumidMin?: number | null
  envHumidMax?: number | null
}

/** ค่าตั้งค่าที่ normalize แล้ว (ไม่มี null/undefined) */
export interface ResolvedEnvironmentConfig {
  requireEnvironment: boolean
  envTempMin: number
  envTempMax: number
  envHumidMin: number
  envHumidMax: number
}

export const ENVIRONMENT_DEFAULTS: ResolvedEnvironmentConfig = {
  requireEnvironment: true,
  envTempMin: 15,
  envTempMax: 35,
  envHumidMin: 20,
  envHumidMax: 80,
}

export interface EnvironmentRecordLike {
  lapTemp?: unknown
  lapHumid?: unknown
  std1?: { tMin?: unknown; tMax?: unknown; hMin?: unknown; hMax?: unknown } | null
}

export interface EnvironmentBound {
  label: string
  unit: string
  value: number | null
  min: number
  max: number
  /** ช่วงอ้างอิงมาจาก std1 ของ record หรือค่าตั้งต้นระบบ */
  source: 'std1' | 'config'
  ok: boolean
}

export interface EnvironmentEvaluation {
  required: boolean
  ok: boolean
  temp: EnvironmentBound
  humid: EnvironmentBound
  /** ข้อความภาษาไทยอธิบายปัญหา (ว่างเมื่อผ่าน) */
  message: string
}

const toFinite = (value: unknown): number | null => {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function evaluateBound(
  label: string,
  unit: string,
  value: unknown,
  stdMin: unknown,
  stdMax: unknown,
  cfgMin: number,
  cfgMax: number,
): EnvironmentBound {
  const sMin = toFinite(stdMin)
  const sMax = toFinite(stdMax)
  const useStd = sMin != null && sMax != null && sMin <= sMax
  const min = useStd ? sMin : cfgMin
  const max = useStd ? sMax : cfgMax
  const v = toFinite(value)
  const ok = v != null && v >= min && v <= max
  return { label, unit, value: v, min, max, source: useStd ? 'std1' : 'config', ok }
}

export function resolveEnvironmentConfig(config?: EnvironmentConfig | null): ResolvedEnvironmentConfig {
  const num = (v: unknown, fallback: number) => {
    const n = toFinite(v)
    return n == null ? fallback : n
  }
  return {
    requireEnvironment: config?.requireEnvironment == null ? ENVIRONMENT_DEFAULTS.requireEnvironment : !!config.requireEnvironment,
    envTempMin: num(config?.envTempMin, ENVIRONMENT_DEFAULTS.envTempMin),
    envTempMax: num(config?.envTempMax, ENVIRONMENT_DEFAULTS.envTempMax),
    envHumidMin: num(config?.envHumidMin, ENVIRONMENT_DEFAULTS.envHumidMin),
    envHumidMax: num(config?.envHumidMax, ENVIRONMENT_DEFAULTS.envHumidMax),
  }
}

export function evaluateEnvironment(record: EnvironmentRecordLike | null | undefined, config?: EnvironmentConfig | null): EnvironmentEvaluation {
  const cfg = resolveEnvironmentConfig(config)
  const std1 = record?.std1 || {}
  const temp = evaluateBound('อุณหภูมิ', '°C', record?.lapTemp, std1.tMin, std1.tMax, cfg.envTempMin, cfg.envTempMax)
  const humid = evaluateBound('ความชื้น', '%RH', record?.lapHumid, std1.hMin, std1.hMax, cfg.envHumidMin, cfg.envHumidMax)
  const problems: string[] = []
  for (const b of [temp, humid]) {
    if (b.value == null) problems.push(`ไม่ได้บันทึก${b.label}`)
    else if (!b.ok) problems.push(`${b.label} ${b.value} ${b.unit} อยู่นอกช่วง ${b.min}–${b.max} ${b.unit}`)
  }
  const ok = problems.length === 0
  return {
    required: cfg.requireEnvironment,
    ok,
    temp,
    humid,
    message: ok ? '' : `สภาวะแวดล้อมไม่ผ่านเกณฑ์: ${problems.join(', ')}`,
  }
}

export class EnvironmentError extends Error {
  status = 409
  evaluation: EnvironmentEvaluation
  constructor(evaluation: EnvironmentEvaluation) {
    super(`${evaluation.message} กรุณาตรวจสอบก่อนขออนุมัติ/อนุมัติใบรับรอง`)
    this.name = 'EnvironmentError'
    this.evaluation = evaluation
  }
}

/** โยน EnvironmentError (409) เมื่อเปิดใช้การตรวจและสภาวะแวดล้อมไม่ผ่านเกณฑ์ */
export function assertEnvironmentForApproval(record: EnvironmentRecordLike | null | undefined, config?: EnvironmentConfig | null): EnvironmentEvaluation {
  const evaluation = evaluateEnvironment(record, config)
  if (evaluation.required && !evaluation.ok) throw new EnvironmentError(evaluation)
  return evaluation
}
