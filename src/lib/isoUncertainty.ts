// src/lib/isoUncertainty.ts
// Universal ISO Uncertainty Calculation Engine
// Implements GUM (JCGM 100:2008) for all ISO calibration methods
// Supports: comparison, spatial_uniformity, comparison_with_ref_bath patterns

import type { IIsoMethodTemplate } from '@/models/IsoMethodTemplate'

// ── Types ──

export interface IsoCalPointData {
  point: number
  uucSetting?: number
  sensorReadings: (number | null)[][]  // [readingIdx][sensorIdx]
  stdReadings?: (number | null)[][]    // tachometer / STD raw readings (ELC-001: AU + BU12)
  uucReadings?: number[]              // UUC display readings (e.g. bath indicator)
  verticalReadings?: {                // vertical uniformity data (Liquid Bath)
    center: number[]
    top: number[]
    bottom: number[]
  }
  standardCorrection?: number
  tNoLoad?: number                    // TEM-001-2 Excel BB7 (T no load)
}

export interface ProbeCorrection {
  probeId: string
  moduleId: string
  coefficients: { a: number; b: number; c: number; d: number }
  residual: number
}

export interface IsoCalcInput {
  methodTemplate: Pick<IIsoMethodTemplate,
    'code' | 'measurementPattern' | 'unit' | 'uncertaintySources' | 'cmcTable' | 'correctionMethod' | 'gridConfig'>
  calPoints: IsoCalPointData[]
  calRefPoints?: IsoCalPointData[]     // for comparison_with_ref_bath
  std1: {
    uTStd?: number
    uTDrif?: number
    uTResStd?: number
    uTUuc?: number
    uTInt?: number
    correction?: number
  }
  uucResolution: number
  probeCorrections?: ProbeCorrection[]
  methodFields?: Record<string, any>   // e.g. wireCondition, chamberSize
  envTemp?: { max: number; min: number }
  envTempScope?: { min: number; max: number }
  confidenceLevel?: number             // default 0.9545
  timeCheck?: { uucTime?: (number | string)[]; stdTime?: (number | string)[] }
}

export interface UncertaintySourceResult {
  key: string
  name: string
  type: 'A' | 'B'
  distribution: string
  value: number
  divisor: number
  ci: number
  ui: number       // standard uncertainty = (value / divisor) * ci
  vi: number       // degrees of freedom
}

export interface SensorPointResult {
  sensorIndex: number
  sensorLabel: string
  mean: number
  stdev: number
  correctedMean: number   // after polynomial correction if applicable
}

export interface CalPointResult {
  point: number
  sensorResults: SensorPointResult[]
  stability: number       // (MAX - MIN) / 2 per sensor over time, max across sensors
  uniformity: number      // MAX |center - position_i|
  verticalUniformity?: number  // MAX |center - top/bottom| from vertical readings
  overallVariation: number // global max - global min across all sensors
  indicatingReading?: number   // UUC display mean (from uucReadings)
  stdMean?: number        // for comparison pattern
  correction?: number     // STD - UUC
  uncertaintyBudget: UncertaintySourceResult[]
  uc: number
  veff: number
  kp: number
  expandedU: number
  cmc: number
  reportedU: number
}

export interface IsoCalcResult {
  methodCode: string
  isoMethodCode?: string
  unit: string
  calPointResults: CalPointResult[]
  timeCheckResult?: {
    avgUucTime: number
    avgStdTime: number
    timeDifference: number
  }
}

// ── Math helpers ──

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

function stdevOfMean(values: number[]): number {
  const valid = values.filter(v => v != null && !isNaN(v) && isFinite(v))
  if (valid.length < 2) return 0
  return stdev(values) / Math.sqrt(valid.length)
}

/** Apply cubic polynomial correction: correction = a*x^3 + b*x^2 + c*x + d */
export function polynomialCorrection(
  x: number,
  coeffs: { a: number; b: number; c: number; d: number }
): number {
  return coeffs.a * x ** 3 + coeffs.b * x ** 2 + coeffs.c * x + coeffs.d
}

// ── t-distribution (reuse from uncertainty.ts logic) ──

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

function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2)
    ? bt * betacf(x, a, b) / a
    : 1 - bt * betacf(1 - x, b, a) / b
}

function tInv2T(p: number, df: number): number {
  if (df <= 0 || !isFinite(df)) return 2.0
  if (df === 1) return Math.cos(p / 2 * Math.PI) / Math.sin(p / 2 * Math.PI)
  const target = 1 - p / 2
  let lo = 0, hi = 1000
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const x = df / (df + mid * mid)
    const cdf = 1 - 0.5 * betai(df / 2, 0.5, x)
    if (cdf < target) lo = mid; else hi = mid
    if (hi - lo < 1e-10) break
  }
  return (lo + hi) / 2
}

function tInv(confidenceLevel: number, veff: number): number {
  if (!isFinite(veff) || veff <= 0) return 2.0
  const p = 1 - confidenceLevel
  return tInv2T(p, Math.floor(veff))
}

// ── Uncertainty source value resolution ──

function flattenStdRaw(stdReadings?: (number | null)[][] | number[]): number[] {
  if (!stdReadings?.length) return []
  const out: number[] = []
  for (const row of stdReadings as any[]) {
    const v = Array.isArray(row) ? Number(row[0]) : Number(row)
    if (Number.isFinite(v)) out.push(v)
  }
  return out
}

/** Excel E = AU (tachometer) + BU12 (interpolation correction) */
function correctedStdValues(cp: IsoCalPointData, fallbackCount: number): number[] {
  const corr = Number(cp.standardCorrection ?? 0)
  const raw = flattenStdRaw(cp.stdReadings as any)
  if (raw.length) return raw.map(v => v + corr)
  const constant = Number(cp.point) + corr
  if (!Number.isFinite(constant)) return []
  return Array.from({ length: Math.max(fallbackCount, 1) }, () => constant)
}

function isTem003Comparison(code?: string) {
  return code === 'TEM-003-1' || code === 'TEM-003-2' || code === 'TEM-003-3'
}

function tem003Inhomogeneity(wireCondition: unknown): number {
  const w = String(wireCondition || '')
  if (w === 'new' || w.includes('สายใหม่') || w.startsWith('New')) return 0.1
  return 0.44
}

function computeIrjError(methodFields?: Record<string, any>): number {
  const s1 = Number(methodFields?.irjStd1)
  const u1 = Number(methodFields?.irjUuc1)
  const s2 = Number(methodFields?.irjStd2)
  const u2 = Number(methodFields?.irjUuc2)
  const hasPair = [methodFields?.irjStd1, methodFields?.irjUuc1, methodFields?.irjStd2, methodFields?.irjUuc2]
    .every(v => v !== '' && v != null && Number.isFinite(Number(v)))
  if (hasPair) return Math.abs((u1 - s1) - (u2 - s2))
  const direct = Number(methodFields?.irjError)
  return Number.isFinite(direct) ? direct : 0
}

function resolveSourceValue(
  source: IIsoMethodTemplate['uncertaintySources'][0],
  ctx: {
    methodCode?: string
    std1: IsoCalcInput['std1']
    uucResolution: number
    sensorReadings: number[][]  // all readings for this cal point [readingIdx][sensorIdx]
    stdReadings?: number[][]
    uucReadings?: number[]      // UUC display readings
    stdMean?: number
    stability: number
    uniformity: number
    verticalUniformity?: number
    polynomialResidual?: number
    methodFields?: Record<string, any>
    envTemp?: { max: number; min: number }
    envTempScope?: { min: number; max: number }
    tNoLoad?: number
    shortTermStability?: number
    irjError?: number
  }
): number {
  const vs = source.valueSource
  if (!vs) return 0

  // ELC-001 Excel Cal 1: Cal/Drift/Res STD are functions of STD mean (E14), not std1 certificate fields.
  if (ctx.methodCode === 'ELC-001') {
    if (source.key === 'dTCal_Std' || source.key === 'dT_Drift_Std') {
      return (ctx.stdMean ?? 0) < 1000 ? 0.12 : 1.2
    }
    if (source.key === 'dT_Res_Std') {
      return (ctx.stdMean ?? 0) > 999 ? 1 : 0.1
    }
  }

  // TEM-003-3 Excel V58: New (สายใหม่)=0.1 else 0.44 (empty AB4 → 0.44)
  if (ctx.methodCode === 'TEM-003-3' && source.key === 'dT_Inh') {
    return tem003Inhomogeneity(ctx.methodFields?.wireCondition)
  }

  switch (vs.type) {
    case 'fixed':
      return vs.fixedValue ?? 0

    case 'from_std_instrument': {
      const field = vs.stdField as keyof typeof ctx.std1
      return Number(ctx.std1?.[field] ?? 0)
    }

    case 'from_uuc_resolution': {
      // TEM-002 Excel dT_Res_UUC = resolution/2 then /√3. ELC-001 uses full resolution then /√3.
      const useHalf = ctx.methodCode === 'ELC-001' ? false : vs.halfRange !== false
      return useHalf ? (ctx.uucResolution || 0) / 2 : (ctx.uucResolution || 0)
    }

    case 'computed_repeatability': {
      if (vs.target === 'std' && ctx.stdReadings) {
        const allStd = ctx.stdReadings.map(row => row.filter(v => v != null && !isNaN(v)))
        if (allStd.length === 0) return 0
        const flat = allStd.flat()
        // TEM-003 Excel = STDEV of readings, not STDEV/√n
        return isTem003Comparison(ctx.methodCode) ? stdev(flat) : stdevOfMean(flat)
      }
      if (vs.target === 'uuc') {
        if (ctx.uucReadings?.length) {
          return stdev(ctx.uucReadings)  // S(q), not S(q)/√n — per Excel convention
        }
        if (!ctx.sensorReadings.length) return 0
        const sensorCount = ctx.sensorReadings[0]?.length || 1
        let maxRep = 0
        for (let s = 0; s < sensorCount; s++) {
          const vals = ctx.sensorReadings.map(row => row[s]).filter(v => v != null && !isNaN(v))
          maxRep = Math.max(maxRep, isTem003Comparison(ctx.methodCode) ? stdev(vals) : stdevOfMean(vals))
        }
        return maxRep
      }
      return 0
    }

    case 'computed_stability':
      return ctx.stability

    case 'computed_uniformity': {
      const multiplier = vs.multiplier ?? 1
      return ctx.uniformity * multiplier
    }

    case 'computed_vertical_uniformity':
      return ctx.verticalUniformity ?? 0

    case 'polynomial_residual':
      return ctx.polynomialResidual ?? 0

    case 'conditional': {
      if (!vs.conditions?.length || !ctx.methodFields) return 0
      for (const cond of vs.conditions) {
        const [field, expected] = cond.condition.split('=')
        if (String(ctx.methodFields[field]) === expected) return cond.value
      }
      return vs.conditions[0]?.value ?? 0
    }

    case 'from_method_field': {
      const key = vs.methodFieldKey ?? ''
      const raw = key === 'tNoLoad'
        ? (ctx.tNoLoad ?? ctx.methodFields?.tNoLoad)
        : ctx.methodFields?.[key]
      if (raw === '' || raw == null || (typeof raw === 'number' && !Number.isFinite(raw))) {
        return (vs.fixedValue ?? 0) * (vs.multiplier ?? 1)
      }
      return Number(raw) * (vs.multiplier ?? 1)
    }

    case 'computed_from_data': {
      // Handle known computed expressions
      switch (vs.expression) {
        case 'tempCoefficient': {
          // If ambient temp is outside scope, compute coefficient
          if (!ctx.envTemp || !ctx.envTempScope) return 0
          const { max, min } = ctx.envTemp
          const scope = ctx.envTempScope
          const maxDev = Math.max(
            min < scope.min ? scope.min - min : 0,
            max > scope.max ? max - scope.max : 0,
          )
          return maxDev * 0.003  // 0.003°C per °C outside range
        }
        case 'shortTermStability':
          return Number(ctx.shortTermStability ?? ctx.methodFields?.shortTermStability ?? 0)
        case 'stdResolution':
          return Number(ctx.methodFields?.stdResolution ?? 0)
        case 'irjError':
          return Number(ctx.irjError ?? computeIrjError(ctx.methodFields))
        case 'centrifugeCalStd':
        case 'centrifugeDriftStd':
          return (ctx.stdMean ?? 0) < 1000 ? 0.12 : 1.2
        case 'centrifugeResStd':
          return (ctx.stdMean ?? 0) > 999 ? 1 : 0.1
        default:
          return 0
      }
    }

    case 'formula':
      // Custom formulas could be evaluated here
      return 0

    default:
      return 0
  }
}

// ── Core calculations ──

/** Compute stability = (MAX - MIN) / 2 for a time-series of sensor readings */
function computeStability(readings: number[]): number {
  const valid = readings.filter(v => v != null && !isNaN(v) && isFinite(v))
  if (valid.length < 2) return 0
  return (Math.max(...valid) - Math.min(...valid)) / 2
}

/** Compute uniformity = MAX across all readings of MAX|center - sensor_i| per reading row */
function computeUniformity(
  readings: (number | null)[][],  // [readingIdx][sensorIdx]
  centerIndex: number,
): number {
  if (!readings.length) return 0
  const sensorCount = readings[0]?.length || 0
  if (sensorCount < 2) return 0

  let maxDev = 0
  for (const row of readings) {
    const center = row[centerIndex]
    if (center == null || isNaN(center)) continue
    for (let i = 0; i < sensorCount; i++) {
      if (i === centerIndex) continue
      const v = row[i]
      if (v == null || isNaN(v)) continue
      maxDev = Math.max(maxDev, Math.abs(center - v))
    }
  }
  return maxDev
}

/** Look up CMC value from the cmcTable for a given calibration point */
function lookupCmc(
  cmcTable: IIsoMethodTemplate['cmcTable'],
  point: number,
): number {
  if (!cmcTable?.length) return 0
  for (const entry of cmcTable) {
    if (point >= entry.rangeMin && point < entry.rangeMax) {
      return entry.value
    }
  }
  // Fallback: last entry
  return cmcTable[cmcTable.length - 1].value
}

/** ELC-001 Excel AH29: IF(T14<1000, 1.2, IF(T14>5000, 2.5, 2.4)) — T14 is UUC mean */
function lookupElc001Cmc(uucMean: number): number {
  if (uucMean < 1000) return 1.2
  if (uucMean > 5000) return 2.5
  return 2.4
}

/** TEM-001-1 Excel AH1036: IF(J987<0, 0.22, IF(J987>40, 1, 0.29)) — J987 is cal point */
function lookupTem001Cmc(calPoint: number): number {
  if (calPoint < 0) return 0.22
  if (calPoint > 40) return 1
  return 0.29
}

/** TEM-001-2 Excel AH1037: IF(J987<0, 1.1, IF(J987>40, Out of range, 0.66)) */
function lookupTem0012Cmc(calPoint: number): number {
  if (calPoint < 0) return 1.1
  if (calPoint > 40) return NaN
  return 0.66
}

/** TEM-003-1 Excel AE60: IF(J5<0, 0.04, 0.03) */
function lookupTem003Cmc(calPoint: number): number {
  return calPoint < 0 ? 0.04 : 0.03
}

/** TEM-003-2 Excel AE60: CMC is a constant 0.05 °C */
function lookupTem0032Cmc(): number {
  return 0.05
}

/** TEM-003-3 Excel AE36: IF(J4>50, 0.5, 0.4) */
function lookupTem0033Cmc(calPoint: number): number {
  return calPoint > 50 ? 0.5 : 0.4
}

/** TEM-004 Excel AG894: CMC is a constant 0.88 °C */
function lookupTem004Cmc(): number {
  return 0.88
}

/** TEM-003-3 AK36: IF(U<CMC, CMC, ROUNDUP(U, 2)) */
function reportTem0033U(expandedU: number, cmc: number): number {
  if (expandedU < cmc) return cmc
  return excelRoundUp(expandedU, 2)
}

/** TEM-004 AG895: IF(U<CMC, CMC, CEILING(U, 0.01)) */
function reportTem004U(expandedU: number, cmc: number): number {
  if (expandedU < cmc) return cmc
  return excelRoundUp(expandedU, 2)
}

/** TEM-003-1 AK60 ROUNDUP(U, 3) / TEM-003-2 AK60 CEILING(U, 0.001) with CMC floor */
function reportTem003U(expandedU: number, cmc: number): number {
  if (expandedU < cmc) return cmc
  return excelRoundUp(expandedU, 3)
}

/** Excel CEILING.MATH(value, significance) for positive temperatures */
function excelCeilingMath(value: number, significance: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(significance) || significance <= 0) return value
  return Math.ceil(value / significance - 1e-10) * significance
}

/** TEM-001-1 AH1037 / TEM-001-2 AH1038: IF(U<CMC, CMC, IF(U>1, ROUNDUP(U,1), ROUNDUP(U,2))) */
function reportTem001U(expandedU: number, cmc: number): number {
  if (Number.isFinite(cmc) && expandedU < cmc) return cmc
  if (expandedU > 1) return excelRoundUp(expandedU, 1)
  return excelRoundUp(expandedU, 2)
}

/** Ceiling to specified precision (e.g. 0.01 → round up to 2 decimal places) */
function ceilTo(value: number, precision: number): number {
  if (precision <= 0) return value
  const factor = 1 / precision
  return Math.ceil(value * factor) / factor
}

/** Excel ROUNDUP(value, digits) — away from zero, with float-nudge for exact tenths */
function excelRoundUp(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** digits
  const scaled = value * factor
  const nearest = Math.round(scaled)
  if (Math.abs(scaled - nearest) < 1e-8) return nearest / factor
  return Math.ceil(scaled - 1e-10) / factor
}

function computeTimeCheck(timeCheck?: IsoCalcInput['timeCheck']) {
  if (!timeCheck) return undefined
  const uucTimes = (timeCheck.uucTime || [])
    .map(t => Number(t))
    .filter(v => !isNaN(v) && v !== 0)
  const stdTimes = (timeCheck.stdTime || [])
    .map(t => Number(t))
    .filter(v => !isNaN(v) && v !== 0)
  if (!uucTimes.length || !stdTimes.length) return undefined
  const avgUucTime = avg(uucTimes)
  const avgStdTime = avg(stdTimes)
  return {
    avgUucTime,
    avgStdTime,
    timeDifference: Math.abs(avgUucTime - avgStdTime),
  }
}

// ── Main calculation function ──

export function calculateIsoUncertainty(input: IsoCalcInput): IsoCalcResult | null {
  const { methodTemplate, calPoints, std1, uucResolution, probeCorrections, methodFields } = input
  const { uncertaintySources, cmcTable, gridConfig } = methodTemplate
  const confidenceLevel = input.confidenceLevel ?? 0.9545

  if (!calPoints?.length) return null

  const calPointResults: CalPointResult[] = []

  for (const cp of calPoints) {
    const point = Number(cp.point)
    if (isNaN(point)) continue

    const rawReadings = cp.sensorReadings || []
    if (!rawReadings.length) continue

    // Determine sensor count
    const sensorCount = rawReadings[0]?.length || 1

    // Apply polynomial corrections if applicable
    const correctedReadings = rawReadings.map(row =>
      row.map((val, sIdx) => {
        if (val == null || isNaN(val)) return null
        if (probeCorrections?.[sIdx]) {
          return val + polynomialCorrection(val, probeCorrections[sIdx].coefficients)
        }
        return val
      })
    )

    // Per-sensor statistics
    const sensorResults: SensorPointResult[] = []
    const sensorMeans: number[] = []

    for (let s = 0; s < sensorCount; s++) {
      const rawVals = rawReadings.map(row => row[s]).filter((v): v is number => v != null && !isNaN(v))
      const corrVals = correctedReadings.map(row => row[s]).filter((v): v is number => v != null && !isNaN(v))
      const vals = corrVals.length > 0 ? corrVals : rawVals

      const mean = avg(vals)
      const sd = stdev(vals)
      sensorMeans.push(mean)

      sensorResults.push({
        sensorIndex: s,
        sensorLabel: gridConfig.sensorLabels?.[s] || `Sensor ${s + 1}`,
        mean,
        stdev: sd,
        correctedMean: avg(corrVals.length > 0 ? corrVals : rawVals),
      })
    }

    // Compute stability: MAX across sensors of per-sensor stability
    let stability = 0
    for (let s = 0; s < sensorCount; s++) {
      const vals = correctedReadings.map(row => row[s]).filter((v): v is number => v != null && !isNaN(v))
      stability = Math.max(stability, computeStability(vals))
    }

    // Compute uniformity: labeled center, else last sensor. TEM-004 Excel uses P2 (index 1).
    const configuredCenterIdx = gridConfig.sensorLabels?.findIndex(label => label.toLowerCase().includes('center')) ?? -1
    const centerIdx = methodTemplate.code === 'TEM-004'
      ? (configuredCenterIdx >= 0 ? configuredCenterIdx : 1)
      : (sensorCount > 1 && configuredCenterIdx >= 0 ? configuredCenterIdx : sensorCount - 1)
    const uniformity = computeUniformity(correctedReadings, centerIdx)

    // Overall variation = global max - global min across all sensors and readings
    let globalMax = -Infinity, globalMin = Infinity
    for (const row of correctedReadings) {
      for (const v of row) {
        if (v != null && !isNaN(v) && isFinite(v)) {
          if (v > globalMax) globalMax = v
          if (v < globalMin) globalMin = v
        }
      }
    }
    const overallVariation = isFinite(globalMax) && isFinite(globalMin) ? globalMax - globalMin : 0

    let verticalUniformity = 0
    const hasVerticalReadings = Boolean(
      cp.verticalReadings
      && (cp.verticalReadings.center.length || cp.verticalReadings.top.length || cp.verticalReadings.bottom.length)
    )
    if (hasVerticalReadings && cp.verticalReadings) {
      const { center, top, bottom } = cp.verticalReadings
      const centerMean = avg(center)
      const topMean = avg(top)
      const bottomMean = avg(bottom)
      verticalUniformity = Math.max(
        Math.abs(centerMean - topMean),
        Math.abs(centerMean - bottomMean),
      )
    } else if (methodTemplate.code === 'TEM-002' && sensorCount >= 3) {
      const layout = input.methodFields?.verticalSensorIndices || {}
      const centerIndex = Number.isInteger(layout.center) ? layout.center : sensorCount - 1
      const topIndex = Number.isInteger(layout.top) ? layout.top : 0
      const bottomIndex = Number.isInteger(layout.bottom) ? layout.bottom : 2
      const valuesAt = (index: number) => correctedReadings
        .map(row => row[index])
        .filter((value): value is number => value != null && !isNaN(value))
      const centerMean = avg(valuesAt(centerIndex))
      const topMean = avg(valuesAt(topIndex))
      const bottomMean = avg(valuesAt(bottomIndex))
      verticalUniformity = Math.max(
        Math.abs(centerMean - topMean),
        Math.abs(centerMean - bottomMean),
      )
    }

    // Indicating reading from UUC display (bath) or single-sensor mean (centrifuge T14)
    const isTem003Dtm = isTem003Comparison(methodTemplate.code)
    const uucMeanRaw = cp.uucReadings?.length
      ? avg(cp.uucReadings)
      : ((methodTemplate.measurementPattern === 'comparison' || isTem003Dtm) && sensorCount === 1
        ? sensorMeans[0]
        : undefined)
    const indicatingReading = methodTemplate.code === 'TEM-003-1' && uucMeanRaw != null && uucResolution > 0
      ? excelCeilingMath(uucMeanRaw, uucResolution)
      : uucMeanRaw

    // Corrected STD readings: Excel E = AU + interpolation correction (BU12)
    const uucN = rawReadings.filter(row => row.some(v => v != null && !isNaN(Number(v)))).length
    const stdCorrected = correctedStdValues(cp, uucN)
    let stdMean: number | undefined
    let correction: number | undefined
    const isComparisonPoint = methodTemplate.measurementPattern === 'comparison' || isTem003Dtm
    if (isComparisonPoint && sensorCount === 1) {
      stdMean = stdCorrected.length ? avg(stdCorrected) : (point + (cp.standardCorrection ?? 0))
      correction = stdMean - (indicatingReading ?? sensorMeans[0])
    }

    let shortTermStability = Number(methodFields?.shortTermStability ?? 0)
    if (isTem003Dtm && input.calRefPoints?.[0]) {
      const ref = input.calRefPoints[0]
      const refStd = flattenStdRaw(ref.stdReadings as any)
      const refUuc = (ref.uucReadings && ref.uucReadings.length)
        ? ref.uucReadings
        : (ref.sensorReadings || []).map(row => row[0]).filter((v): v is number => v != null && !isNaN(Number(v)))
      const uucRaw = uucMeanRaw ?? sensorMeans[0]
      if (refStd.length && refUuc.length && stdMean != null && uucRaw != null) {
        shortTermStability = Math.abs((stdMean - uucRaw) - (avg(refStd) - avg(refUuc)))
      }
    }

    // Max polynomial residual
    const polynomialResidual = probeCorrections?.length
      ? Math.max(...probeCorrections.map(p => p.residual || 0))
      : 0

    // Convert readings to number[][] for source resolution
    const numReadings = correctedReadings.map(row =>
      row.map(v => v ?? NaN)
    )
    const numStdReadings = stdCorrected.length
      ? stdCorrected.map(v => [v])
      : cp.stdReadings?.map(row => row.map(v => v ?? NaN))

    // Build uncertainty budget
    const uncertaintyBudget: UncertaintySourceResult[] = []

    for (const source of uncertaintySources) {
      if (!source.enabled) continue

      const value = resolveSourceValue(source, {
        methodCode: methodTemplate.code,
        std1,
        uucResolution,
        sensorReadings: numReadings,
        stdReadings: numStdReadings,
        uucReadings: cp.uucReadings,
        stdMean,
        stability,
        uniformity,
        verticalUniformity,
        polynomialResidual,
        methodFields,
        envTemp: input.envTemp,
        envTempScope: input.envTempScope,
        tNoLoad: cp.tNoLoad,
        shortTermStability,
        irjError: methodTemplate.code === 'TEM-003-3' ? computeIrjError(methodFields) : undefined,
      })

      const ci = source.sensitivityCoefficient ?? 1
      const ui = (value / source.divisor) * ci

      let vi: number
      if (source.degreesOfFreedom === 'infinity' || source.degreesOfFreedom === Infinity) {
        vi = Infinity
      } else if (source.degreesOfFreedom === 'n-1') {
        const nStd = stdCorrected.length
        const nUucDisplay = (cp.uucReadings || []).filter(v => v != null && !isNaN(Number(v)) && isFinite(Number(v))).length
        const nUuc = numReadings.filter(r => r.some(v => !isNaN(v))).length
        const n = (source.key === 'dT_Rep_Std' && nStd > 0)
          ? nStd
          : (source.key === 'dT_Rep_UUC' && nUucDisplay > 1)
            ? nUucDisplay
            : nUuc
        vi = Math.max(n - 1, 1)
      } else {
        vi = Number(source.degreesOfFreedom) || Infinity
      }

      uncertaintyBudget.push({
        key: source.key,
        name: source.name,
        type: source.type,
        distribution: source.distribution,
        value,
        divisor: source.divisor,
        ci,
        ui,
        vi,
      })
    }

    // Combined standard uncertainty
    const uc = Math.sqrt(uncertaintyBudget.reduce((sum, s) => sum + s.ui ** 2, 0))

    // Welch-Satterthwaite effective degrees of freedom
    const typeAComponents = uncertaintyBudget.filter(s => s.type === 'A' && isFinite(s.vi) && s.ui > 0)
    let veff: number
    if (typeAComponents.length === 0 || uc === 0) {
      veff = Infinity
    } else {
      const denominator = typeAComponents.reduce((sum, s) => sum + (s.ui ** 4) / s.vi, 0)
      veff = denominator === 0 ? Infinity : (uc ** 4) / denominator
    }

    // Coverage factor
    const kp = tInv(confidenceLevel, veff)

    // Expanded uncertainty
    const expandedU = kp * uc

    const uucMeanForCmc = indicatingReading ?? sensorMeans[0] ?? point
    const cmc = methodTemplate.code === 'ELC-001'
      ? lookupElc001Cmc(uucMeanForCmc)
      : methodTemplate.code === 'TEM-001-1'
        ? lookupTem001Cmc(point)
        : methodTemplate.code === 'TEM-001-2'
          ? lookupTem0012Cmc(point)
          : methodTemplate.code === 'TEM-003-1'
            ? lookupTem003Cmc(point)
            : methodTemplate.code === 'TEM-003-2'
              ? lookupTem0032Cmc()
              : methodTemplate.code === 'TEM-003-3'
                ? lookupTem0033Cmc(point)
                : methodTemplate.code === 'TEM-004'
                  ? lookupTem004Cmc()
                  : lookupCmc(cmcTable, point)

    // TEM-002: CEILING(U, 0.01), no CMC floor.
    // ELC-001 Excel AH30: CMC floor, then ROUNDUP(U, 1) if U ≥ CMC.
    // TEM-001-1 AH1037 / TEM-001-2 AH1038: if U < CMC use CMC; if U > 1 ROUNDUP 1 dp else ROUNDUP 2 dp.
    // TEM-003-1 AK60: if U < CMC use CMC else ROUNDUP(U, 3).
    // TEM-003-2 AK60: if U < CMC use CMC else CEILING(U, 0.001).
    // TEM-003-3 AK36: if U < CMC use CMC else ROUNDUP(U, 2).
    // TEM-004 AG895: if U < CMC use CMC else CEILING(U, 0.01).
    const reportedU = methodTemplate.code === 'ELC-001'
      ? (expandedU < cmc ? excelRoundUp(cmc, 2) : excelRoundUp(expandedU, 1))
      : (methodTemplate.code === 'TEM-001-1' || methodTemplate.code === 'TEM-001-2')
        ? reportTem001U(expandedU, cmc)
        : (methodTemplate.code === 'TEM-003-1' || methodTemplate.code === 'TEM-003-2')
          ? reportTem003U(expandedU, cmc)
          : methodTemplate.code === 'TEM-003-3'
            ? reportTem0033U(expandedU, cmc)
            : methodTemplate.code === 'TEM-004'
              ? reportTem004U(expandedU, cmc)
              : ceilTo(expandedU, 0.01)

    calPointResults.push({
      point,
      sensorResults,
      stability,
      uniformity,
      verticalUniformity: verticalUniformity || undefined,
      overallVariation,
      indicatingReading,
      stdMean,
      correction,
      uncertaintyBudget,
      uc,
      veff,
      kp,
      expandedU,
      cmc,
      reportedU,
    })
  }

  return {
    methodCode: methodTemplate.code,
    isoMethodCode: methodTemplate.code,
    unit: methodTemplate.unit,
    calPointResults,
    timeCheckResult: computeTimeCheck(input.timeCheck),
  }
}

// ── Formatting helpers ──

export function fmtU(value: number, decimals = 2): string {
  if (value == null || isNaN(value)) return '-'
  return value.toFixed(decimals)
}

export function fmtVeff(veff: number): string {
  if (!isFinite(veff)) return '∞'
  return veff.toFixed(1)
}

export function distributionLabel(dist: string): string {
  switch (dist) {
    case 'normal': return 'Normal'
    case 'rectangular': return 'Rectangular'
    case 'triangular': return 'Triangular'
    default: return dist
  }
}
