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

function tInv(confidenceLevel: number, veff: number): number {
  if (!isFinite(veff) || veff <= 0) {
    if (confidenceLevel >= 0.9999) return 3.291
    if (confidenceLevel >= 0.99) return 2.576
    if (confidenceLevel >= 0.9545) return 2.000
    if (confidenceLevel >= 0.95) return 1.960
    return 2.000
  }

  const table9545: [number, number][] = [
    [1, 13.97], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
    [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
    [12, 2.179], [15, 2.131], [20, 2.086], [25, 2.060], [30, 2.042],
    [40, 2.021], [60, 2.000], [120, 1.980], [Infinity, 1.960],
  ]
  const table95: [number, number][] = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
    [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
    [12, 2.179], [15, 2.131], [20, 2.086], [25, 2.060], [30, 2.042],
    [40, 2.021], [60, 2.000], [120, 1.980], [Infinity, 1.960],
  ]
  const table99: [number, number][] = [
    [1, 63.657], [2, 9.925], [3, 5.841], [4, 4.604], [5, 4.032],
    [6, 3.707], [7, 3.499], [8, 3.355], [9, 3.250], [10, 3.169],
    [12, 3.055], [15, 2.947], [20, 2.845], [25, 2.787], [30, 2.750],
    [40, 2.704], [60, 2.660], [120, 2.617], [Infinity, 2.576],
  ]

  let table: [number, number][]
  if (confidenceLevel >= 0.985) table = table99
  else if (confidenceLevel >= 0.952) table = table9545
  else table = table95

  for (let i = 0; i < table.length - 1; i++) {
    const [v0, k0] = table[i]
    const [v1, k1] = table[i + 1]
    if (veff >= v0 && veff <= v1) {
      const t = (veff - v0) / (v1 - v0)
      return k0 + t * (k1 - k0)
    }
  }
  return 2.000
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
    components,
    uc, veff, k, U,
    formulaCode: formula.code,
    formulaName: formula.name,
  }
}

function toCalPointInputs(calPoints: any[]): CalPointInput[] {
  if (!Array.isArray(calPoints)) return []
  return calPoints.map(p => ({
    point: Number(p.point ?? 0),
    uucReadings: (p.readings ?? []).map(Number),
    stdReadings: (p.standards ?? []).map(Number),
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
