// src/lib/uncertainty.ts
// Uncertainty Calculation Engine v2
// อ้างอิง: GUM (JCGM 100:2008), Google Sheets P12N/P123N/P12T/P123T/P12Time

export interface FormulaConfig {
  code: string
  name: string
  confidenceLevel: number
  divisorNormal: number
  divisorRect: number
  numReadings: number
  forceK: number | null
}

export const STANDARD_FORMULA: FormulaConfig = {
  code: 'standard',
  name: 'สูตรมาตรฐาน (95.45%)',
  confidenceLevel: 0.9545,
  divisorNormal: 2,
  divisorRect: 1.732050808,
  numReadings: 4,
  forceK: null,
}

export interface CalPointInput {
  point: number
  uucReadings: number[]
  stdReadings: number[]
}

export interface StdUncertaintyParams {
  stdCorrection: number
  uTStd: number
  uTDrif: number
  uTResStd: number
  uTUuc: number
  uTInt: number
}

export interface UncertaintyComponent {
  symbol: string
  type: 'A' | 'B'
  source: string
  value: number
  probability: string
  divisor: number
  ci: number
  ui: number
  vi: number
  ui2: number
}

export interface CalPointResult {
  point: number
  avgUUC: number
  uTRepUUC: number
  avgSTD: number
  uTRepSTD: number
  avgSTDRead: number
  correction: number
  stdCorrection: number
  uucReadings: number[]
  stdReadings: number[]
  components: UncertaintyComponent[]
  uc: number
  veff: number
  k: number
  U: number
  formulaCode: string
  formulaName: string
}

export interface UcComponentResult {
  name: string
  stdNo: string
  stdName: string
  measurement: string
  unit: string
  formulaCode: string
  formulaName: string
  points: CalPointResult[]
}

export interface SummaryRow {
  ucName: string
  point: number
  avgUUC: number
  avgSTDRead: number
  correction: number
  uc: number
  U: number
  k: number
  unit: string
  formulaName: string
}

export function parseCalibrationValue(value: unknown): number {
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim()
  if (!text) return NaN
  const numeric = Number(text)
  if (Number.isFinite(numeric)) return numeric

  const match = text.match(/^(\d{1,3}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/)
  if (!match) return NaN
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] || 0)
  const fraction = match[4] ? Number(`0.${match[4]}`) : 0
  if (minutes >= 60 || seconds >= 60) return NaN
  return hours * 3600 + minutes * 60 + seconds + fraction
}

export function formatCalibrationValue(value: number | null | undefined, time = false, decimals = 3): string {
  if (value == null || !Number.isFinite(value)) return '-'
  if (!time) return value.toFixed(decimals)
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)
  const hours = Math.floor(absolute / 3600)
  const minutes = Math.floor((absolute % 3600) / 60)
  const seconds = absolute % 60
  const secondText = seconds.toFixed(decimals).padStart(decimals === 0 ? 2 : 2 + decimals + 1, '0')
  return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secondText}`
}

function avg(values: number[]): number {
  const valid = values.filter(v => v != null && !isNaN(v) && isFinite(v))
  if (valid.length === 0) return 0
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

function stdev(values: number[]): number {
  const valid = values.filter(v => v != null && !isNaN(v) && isFinite(v))
  if (valid.length < 2) return 0
  const mean = avg(valid)
  const variance = valid.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (valid.length - 1)
  return Math.sqrt(variance)
}

// ── Numerical inverse t-distribution (matches Excel T.INV.2T) ──

/** Lanczos approximation for ln(Γ(x)) */
function lgamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < c.length; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

/** Continued fraction for regularized incomplete beta function */
function betacf(x: number, a: number, b: number): number {
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return h
}

/** Regularized incomplete beta function I_x(a, b) */
function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? bt * betacf(x, a, b) / a
    : 1 - bt * betacf(1 - x, b, a) / b
}

/** Two-tailed inverse t-distribution: find t such that P(|T| > t | df) = p */
function tInv2T(p: number, df: number): number {
  if (df <= 0 || !isFinite(df)) return 2.0
  if (df === 1) return Math.cos(p / 2 * Math.PI) / Math.sin(p / 2 * Math.PI)

  const target = 1 - p / 2 // one-tail CDF target
  // Bisection on t-distribution CDF
  let lo = 0, hi = 1000
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const x = df / (df + mid * mid)
    const cdf = 1 - 0.5 * betai(df / 2, 0.5, x) // P(T <= mid)
    if (cdf < target) lo = mid; else hi = mid
    if (hi - lo < 1e-10) break
  }
  return (lo + hi) / 2
}

function tInv(confidenceLevel: number, veff: number): number {
  if (!isFinite(veff) || veff <= 0) {
    if (confidenceLevel >= 0.9999) return 3.291
    if (confidenceLevel >= 0.99) return 2.576
    if (confidenceLevel >= 0.9545) return 2.000
    if (confidenceLevel >= 0.95) return 1.960
    return 2.000
  }
  const p = 1 - confidenceLevel // two-tailed p-value (e.g. 0.0455 for 95.45%)
  // Floor veff to integer (GUM standard: conservative k-factor lookup)
  return tInv2T(p, Math.floor(veff))
}

export function calculateCalPointBudget(
  pointInput: CalPointInput,
  stdParams: StdUncertaintyParams,
  formula: FormulaConfig = STANDARD_FORMULA,
): CalPointResult {
  const { point, uucReadings, stdReadings } = pointInput
  const { stdCorrection, uTStd, uTDrif, uTResStd, uTUuc, uTInt } = stdParams
  const { confidenceLevel, divisorNormal, divisorRect, numReadings, forceK } = formula

  const sqrtN = Math.sqrt(numReadings)
  const avgUUC = avg(uucReadings)
  const uTRepUUC = stdev(uucReadings) / sqrtN
  const avgSTD = avg(stdReadings)
  const uTRepSTD = stdev(stdReadings) / sqrtN
  const avgSTDRead = avgSTD + stdCorrection
  const correction = avgSTDRead - avgUUC

  const components: UncertaintyComponent[] = [
    {
      symbol: 'uT Rep.(UUC)', type: 'B', source: 'Repeatability of UUC',
      value: uTRepUUC, probability: 'normal', divisor: 1, ci: 1,
      ui: uTRepUUC, vi: 3, ui2: uTRepUUC ** 2,
    },
    {
      symbol: 'uT Rep.(STD)', type: 'B', source: 'Repeatability of STD',
      value: uTRepSTD, probability: 'normal', divisor: 1, ci: 1,
      ui: uTRepSTD, vi: 3, ui2: uTRepSTD ** 2,
    },
    {
      symbol: 'uT STD', type: 'A', source: 'Calibration of STD',
      value: uTStd, probability: 'normal', divisor: divisorNormal, ci: 1,
      ui: uTStd / divisorNormal, vi: Infinity, ui2: (uTStd / divisorNormal) ** 2,
    },
    {
      symbol: 'uT Drif', type: 'A', source: 'Drift of STD',
      value: uTDrif, probability: 'rectangular', divisor: divisorRect, ci: 1,
      ui: uTDrif / divisorRect, vi: Infinity, ui2: (uTDrif / divisorRect) ** 2,
    },
    {
      symbol: 'uT Res.(STD)', type: 'A', source: 'Resolution of STD',
      value: uTResStd, probability: 'rectangular', divisor: divisorRect, ci: 1,
      ui: uTResStd / divisorRect, vi: Infinity, ui2: (uTResStd / divisorRect) ** 2,
    },
    {
      symbol: 'uT Res.(UUC)', type: 'A', source: 'Resolution of UUC',
      value: uTUuc, probability: 'rectangular', divisor: divisorRect, ci: 1,
      ui: uTUuc / divisorRect, vi: Infinity, ui2: (uTUuc / divisorRect) ** 2,
    },
    {
      symbol: 'uT Int.', type: 'A', source: 'Interpolation error',
      value: uTInt, probability: 'rectangular', divisor: divisorRect, ci: 1,
      ui: uTInt / divisorRect, vi: Infinity, ui2: (uTInt / divisorRect) ** 2,
    },
  ]

  const uc = Math.sqrt(components.reduce((acc, c) => acc + c.ui2, 0))
  const uiRepUUC = components[0].ui
  const uiRepSTD = components[1].ui
  const denominator = (uiRepUUC ** 4) / 3 + (uiRepSTD ** 4) / 3
  const veff = denominator === 0 ? Infinity : (uc ** 4) / denominator
  const k = forceK != null ? forceK : tInv(confidenceLevel, veff)
  const U = uc * k

  return {
    point,
    avgUUC, uTRepUUC, avgSTD, uTRepSTD, avgSTDRead, correction,
    stdCorrection,
    uucReadings,
    stdReadings,
    components,
    uc, veff, k, U,
    formulaCode: formula.code,
    formulaName: formula.name,
  }
}

function toCalPointInputs(calPoints: any[]): CalPointInput[] {
  if (!Array.isArray(calPoints)) return []
  return calPoints.map(p => ({
    point: parseCalibrationValue(p.point),
    uucReadings: (p.readings ?? []).map(parseCalibrationValue),
    stdReadings: (p.standards ?? []).map(parseCalibrationValue),
  }))
}

function toStdParams(std: any): StdUncertaintyParams {
  return {
    stdCorrection: Number(std?.correction ?? 0),
    uTStd: Number(std?.uTStd ?? 0),
    uTDrif: Number(std?.uTDrif ?? 0),
    uTResStd: Number(std?.uTResStd ?? 0),
    uTUuc: Number(std?.uTUuc ?? 0),
    uTInt: Number(std?.uTInt ?? 0),
  }
}

export function calculateUcComponent(
  name: string,
  stdInfo: { no: string; name: string; measurement: string; unit: string },
  stdParams: StdUncertaintyParams,
  calPoints: CalPointInput[],
  formula: FormulaConfig = STANDARD_FORMULA,
): UcComponentResult {
  const validPoints = calPoints.filter(
    p => p.uucReadings?.some(v => v != null && !isNaN(v) && v !== 0)
  )
  const points = validPoints.map(p => calculateCalPointBudget(p, stdParams, formula))

  return {
    name,
    stdNo: stdInfo.no,
    stdName: stdInfo.name,
    measurement: stdInfo.measurement,
    unit: stdInfo.unit,
    formulaCode: formula.code,
    formulaName: formula.name,
    points,
  }
}

export function calculateAllUcComponents(
  record: any,
  formulaMap: Partial<Record<string, FormulaConfig>> = {},
): Record<string, UcComponentResult> {
  const result: Record<string, UcComponentResult> = {}
  const ucKeys = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const

  for (const key of ucKeys) {
    const uc = record[key]
    if (!uc?.std?.no && !uc?.calPoints?.length) continue
    const stdInfo = {
      no: String(uc.std?.no ?? ''),
      name: String(uc.std?.name ?? ''),
      measurement: String(uc.std?.measurement ?? ''),
      unit: String(uc.std?.unit ?? ''),
    }
    const stdParams = toStdParams(uc.std)
    const calPoints = toCalPointInputs(uc.calPoints ?? [])
    const formula = formulaMap[key] ?? STANDARD_FORMULA
    result[key] = calculateUcComponent(key, stdInfo, stdParams, calPoints, formula)
  }

  return result
}

export function buildSummaryTable(
  ucResults: Record<string, UcComponentResult>,
): SummaryRow[] {
  const rows: SummaryRow[] = []
  for (const [key, uc] of Object.entries(ucResults)) {
    if (!uc) continue
    for (const pt of uc.points) {
      rows.push({
        ucName: key,
        point: pt.point,
        avgUUC: pt.avgUUC,
        avgSTDRead: pt.avgSTDRead,
        correction: pt.correction,
        uc: pt.uc,
        U: pt.U,
        k: pt.k,
        unit: uc.unit,
        formulaName: pt.formulaName,
      })
    }
  }
  return rows
}

// ──── ISO Calibration Calculation ────

export interface IsoSensorResult {
  sensorIndex: number
  calPointResults: CalPointResult[]
}

export interface IsoCalPointSummary {
  point: number
  sensorResults: {
    sensorIndex: number
    avgUUC: number
    avgSTDRead: number
    correction: number
    uc: number
    U: number
    k: number
  }[]
}

export interface IsoCalculationResult {
  isoMethodCode: string
  unit: string
  stdNo: string
  stdName: string
  sensorResults: IsoSensorResult[]
  calPointSummaries: IsoCalPointSummary[]
  timeCheckResult?: {
    avgUucTime: number
    avgStdTime: number
    timeDifference: number
  }
}

/**
 * Calculate uncertainty budget for an ISO calibration record.
 *
 * ISO records store data in isoData.calPoints[].sensorReadings[readingIdx][sensorIdx].
 * For single-sensor methods (ELC-001, TEM-003), there's 1 sensor column.
 * For multi-sensor methods (TEM-001, TEM-002, TEM-004), there are 5 sensor columns.
 *
 * STD readings = point + standardCorrection (constant for all readings within a cal point).
 * Uncertainty params come from std1 on the record.
 */
export function calculateIsoRecord(
  record: any,
  formula: FormulaConfig = STANDARD_FORMULA,
): IsoCalculationResult | null {
  const isoData = record.isoData
  if (!isoData?.calPoints?.length) return null

  const isoMethodCode = String(record.isoMethodCode || '')
  const std1 = record.std1 || {}
  const stdParams: StdUncertaintyParams = {
    stdCorrection: Number(std1.correction ?? 0),
    uTStd: Number(std1.uTStd ?? 0),
    uTDrif: Number(std1.uTDrif ?? 0),
    uTResStd: Number(std1.uTResStd ?? 0),
    uTUuc: Number(std1.uTUuc ?? 0),
    uTInt: Number(std1.uTInt ?? 0),
  }
  const unit = String(std1.unit || '')
  const stdNo = String(std1.no || '')
  const stdName = String(std1.name || '')

  // Determine sensor count from data
  const firstPoint = isoData.calPoints[0]
  const firstRow = Array.isArray(firstPoint?.sensorReadings?.[0]) ? firstPoint.sensorReadings[0] : []
  const sensorCount = firstRow.length || 1

  // For each sensor, collect cal point results
  const sensorResults: IsoSensorResult[] = []

  for (let sIdx = 0; sIdx < sensorCount; sIdx++) {
    const calPointResults: CalPointResult[] = []

    for (const cp of isoData.calPoints) {
      const point = Number(cp.point ?? 0)
      if (!point && point !== 0) continue

      const sensorReadings = Array.isArray(cp.sensorReadings) ? cp.sensorReadings : []
      const uucReadings: number[] = sensorReadings
        .map((row: any[]) => Number(row?.[sIdx] ?? NaN))
        .filter((v: number) => !isNaN(v) && v !== 0)

      if (uucReadings.length === 0) continue

      // STD readings: constant value = point + standardCorrection
      const stdValue = point + Number(cp.standardCorrection ?? 0)
      const stdReadings = uucReadings.map(() => stdValue)

      const pointInput: CalPointInput = { point, uucReadings, stdReadings }
      const result = calculateCalPointBudget(pointInput, stdParams, {
        ...formula,
        numReadings: uucReadings.length,
      })
      calPointResults.push(result)
    }

    if (calPointResults.length > 0) {
      sensorResults.push({ sensorIndex: sIdx, calPointResults })
    }
  }

  // Build cal point summaries
  const calPointSummaries: IsoCalPointSummary[] = []
  const uniquePoints: number[] = Array.from(new Set(isoData.calPoints.map((cp: any) => Number(cp.point ?? 0)) as number[]))
  for (const point of uniquePoints) {
    const sensorSummaries = sensorResults.map(sr => {
      const ptResult = sr.calPointResults.find(r => r.point === point)
      return ptResult ? {
        sensorIndex: sr.sensorIndex,
        avgUUC: ptResult.avgUUC,
        avgSTDRead: ptResult.avgSTDRead,
        correction: ptResult.correction,
        uc: ptResult.uc,
        U: ptResult.U,
        k: ptResult.k,
      } : null
    }).filter(Boolean) as IsoCalPointSummary['sensorResults']

    if (sensorSummaries.length > 0) {
      calPointSummaries.push({ point, sensorResults: sensorSummaries })
    }
  }

  // Time check calculation
  let timeCheckResult: IsoCalculationResult['timeCheckResult']
  if (isoData.timeCheck) {
    const uucTimes = (isoData.timeCheck.uucTime || [])
      .map((t: string) => Number(t))
      .filter((v: number) => !isNaN(v) && v !== 0)
    const stdTimes = (isoData.timeCheck.stdTime || [])
      .map((t: string) => Number(t))
      .filter((v: number) => !isNaN(v) && v !== 0)

    if (uucTimes.length > 0 && stdTimes.length > 0) {
      const avgUucTime = avg(uucTimes)
      const avgStdTime = avg(stdTimes)
      timeCheckResult = {
        avgUucTime,
        avgStdTime,
        timeDifference: Math.abs(avgUucTime - avgStdTime),
      }
    }
  }

  return {
    isoMethodCode,
    unit,
    stdNo,
    stdName,
    sensorResults,
    calPointSummaries,
    timeCheckResult,
  }
}

export function fmt(value: number, decimals = 4): string {
  if (value == null || isNaN(value)) return '-'
  return value.toFixed(decimals)
}

export function fmtVeff(veff: number): string {
  if (!isFinite(veff)) return '∞'
  return veff.toFixed(2)
}
