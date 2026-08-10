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
  stdReadings?: (number | null)[][]    // for comparison_with_ref_bath
  uucReadings?: number[]              // UUC display readings (e.g. bath indicator)
  verticalReadings?: {                // vertical uniformity data (Liquid Bath)
    center: number[]
    top: number[]
    bottom: number[]
  }
  standardCorrection?: number
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

function resolveSourceValue(
  source: IIsoMethodTemplate['uncertaintySources'][0],
  ctx: {
    std1: IsoCalcInput['std1']
    uucResolution: number
    sensorReadings: number[][]  // all readings for this cal point [readingIdx][sensorIdx]
    stdReadings?: number[][]
    uucReadings?: number[]      // UUC display readings
    stability: number
    uniformity: number
    verticalUniformity?: number
    polynomialResidual?: number
    methodFields?: Record<string, any>
    envTemp?: { max: number; min: number }
    envTempScope?: { min: number; max: number }
  }
): number {
  const vs = source.valueSource
  if (!vs) return 0

  switch (vs.type) {
    case 'fixed':
      return vs.fixedValue ?? 0

    case 'from_std_instrument': {
      const field = vs.stdField as keyof typeof ctx.std1
      return Number(ctx.std1?.[field] ?? 0)
    }

    case 'from_uuc_resolution':
      return (ctx.uucResolution || 0) / 2

    case 'computed_repeatability': {
      if (vs.target === 'std' && ctx.stdReadings) {
        // Flatten std readings per sensor and compute stdev of means
        const allStd = ctx.stdReadings.map(row => row.filter(v => v != null && !isNaN(v)))
        if (allStd.length === 0) return 0
        const flat = allStd.flat()
        return stdevOfMean(flat)
      }
      if (vs.target === 'uuc') {
        // If separate UUC readings are provided (e.g. bath display), use those
        if (ctx.uucReadings?.length) {
          return stdev(ctx.uucReadings)  // S(q), not S(q)/√n — per Excel convention
        }
        // Fallback: compute from sensor readings (for comparison methods)
        if (!ctx.sensorReadings.length) return 0
        const sensorCount = ctx.sensorReadings[0]?.length || 1
        let maxStdevMean = 0
        for (let s = 0; s < sensorCount; s++) {
          const vals = ctx.sensorReadings.map(row => row[s]).filter(v => v != null && !isNaN(v))
          maxStdevMean = Math.max(maxStdevMean, stdevOfMean(vals))
        }
        return maxStdevMean
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

    case 'from_method_field':
      return Number(ctx.methodFields?.[vs.methodFieldKey ?? ''] ?? 0)

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
          // Would be computed from repeated 0°C check — use 0 if not provided
          return Number(ctx.methodFields?.shortTermStability ?? 0)
        case 'stdResolution':
          return Number(ctx.methodFields?.stdResolution ?? 0)
        case 'irjError':
          return Number(ctx.methodFields?.irjError ?? 0)
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

/** Ceiling to specified precision (e.g. 0.01 → round up to 2 decimal places) */
function ceilTo(value: number, precision: number): number {
  if (precision <= 0) return value
  const factor = 1 / precision
  return Math.ceil(value * factor) / factor
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

    // Compute uniformity: use last sensor as center (convention from Excel)
    const configuredCenterIdx = gridConfig.sensorLabels?.findIndex(label => label.toLowerCase().includes('center')) ?? -1
    const centerIdx = sensorCount > 1 && configuredCenterIdx >= 0
      ? configuredCenterIdx
      : sensorCount - 1
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

    // Indicating reading from UUC display
    const indicatingReading = cp.uucReadings?.length ? avg(cp.uucReadings) : undefined

    // Max polynomial residual
    const polynomialResidual = probeCorrections?.length
      ? Math.max(...probeCorrections.map(p => p.residual || 0))
      : 0

    // Convert readings to number[][] for source resolution
    const numReadings = correctedReadings.map(row =>
      row.map(v => v ?? NaN)
    )
    const numStdReadings = cp.stdReadings?.map(row =>
      row.map(v => v ?? NaN)
    )

    // Build uncertainty budget
    const uncertaintyBudget: UncertaintySourceResult[] = []

    for (const source of uncertaintySources) {
      if (!source.enabled) continue

      const value = resolveSourceValue(source, {
        std1,
        uucResolution,
        sensorReadings: numReadings,
        stdReadings: numStdReadings,
        uucReadings: cp.uucReadings,
        stability,
        uniformity,
        verticalUniformity,
        polynomialResidual,
        methodFields,
        envTemp: input.envTemp,
        envTempScope: input.envTempScope,
      })

      const ci = source.sensitivityCoefficient ?? 1
      const ui = (value / source.divisor) * ci

      let vi: number
      if (source.degreesOfFreedom === 'infinity' || source.degreesOfFreedom === Infinity) {
        vi = Infinity
      } else if (source.degreesOfFreedom === 'n-1') {
        // Get n from readings
        const n = numReadings.filter(r => r.some(v => !isNaN(v))).length
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

    // CMC lookup (informational — not used as floor per Excel convention)
    const cmc = lookupCmc(cmcTable, point)

    // Reported uncertainty = U rounded up to 2 decimal places
    const reportedU = ceilTo(expandedU, 0.01)

    // Correction for comparison pattern
    let stdMean: number | undefined
    let correction: number | undefined
    if (methodTemplate.measurementPattern === 'comparison' && sensorCount === 1) {
      stdMean = point + (cp.standardCorrection ?? 0)
      correction = stdMean - sensorMeans[0]
    }

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
    unit: methodTemplate.unit,
    calPointResults,
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
