import {
  describeAcceptance,
  evaluatePoint,
  isVerdict,
  summarizeVerdicts,
  type AcceptanceCriteria,
  type Verdict,
} from '@/lib/acceptance'
import { parseCalibrationValue } from '@/lib/uncertainty'

export const UC_KEYS = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
export type AcceptanceGroup = (typeof UC_KEYS)[number] | 'iso'

export interface AcceptancePointResult {
  /** 'uc1'..'ucT' สำหรับระบบทั่วไป, 'iso' สำหรับจุดสอบเทียบ ISO */
  group: AcceptanceGroup
  /** ดัชนีจุดใน calPoints ของกลุ่มนั้น */
  index: number
  point: unknown
  unit: string
  /** ค่าคลาดเคลื่อน UUC − STD */
  error: number
  expandedU: number
  reference: number
  autoVerdict: Verdict
  /** ผลที่ใช้จริง (ค่าที่กำหนดเองถ้ามี) */
  verdict: Verdict
  manual: boolean
}

export interface AcceptanceResult {
  acceptance: AcceptanceCriteria | null
  description: string
  points: AcceptancePointResult[]
  autoOverall: Verdict
  overall: Verdict
  overallManual: boolean
}

type SummaryLike = { ucName: string; avgUUC: number; avgSTDRead: number; correction: number; U: number; unit?: string }

const num = (v: unknown): number => {
  if (v === '' || v == null) return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function pointResult(
  group: AcceptanceGroup,
  index: number,
  point: unknown,
  unit: string,
  error: number,
  expandedU: number,
  reference: number,
  acceptance: AcceptanceCriteria | null,
  override: unknown,
): AcceptancePointResult {
  const autoVerdict = evaluatePoint(error, expandedU, acceptance, reference)
  const manual = isVerdict(override)
  return {
    group, index, point, unit, error, expandedU, reference, autoVerdict,
    verdict: manual ? (override as Verdict) : autoVerdict,
    manual,
  }
}

/**
 * รวมผลคำนวณ (summary ของระบบทั่วไป หรือ isoResult) เข้ากับเกณฑ์ MPE และค่าที่ผู้ใช้กำหนดเอง
 * เพื่อให้ได้ผล ผ่าน/ไม่ผ่าน/N/A ต่อจุดและผลรวม — ใช้ทั้งหน้าคำนวณ ใบรับรอง PDF และการบันทึกลง record
 */
export function buildAcceptanceResult(
  record: any,
  calculation: { calibrationType?: string; summary?: SummaryLike[] | null; isoResult?: any },
): AcceptanceResult {
  const acceptance: AcceptanceCriteria | null = record?.acceptance && record.acceptance.mpe !== '' && record.acceptance.mpe != null
    ? record.acceptance
    : null
  const points: AcceptancePointResult[] = []
  let unit = ''

  if (calculation.calibrationType === 'iso' || record?.calibrationType === 'iso') {
    const isoResult = calculation.isoResult
    const isoPoints: any[] = Array.isArray(record?.isoData?.calPoints) ? record.isoData.calPoints : []
    unit = String(isoResult?.unit || '')
    if (Array.isArray(isoResult?.calPointResults)) {
      isoResult.calPointResults.forEach((pt: any, index: number) => {
        const correction = num(pt.correction)
        const error = Number.isFinite(correction) ? -correction : num(pt.overallVariation)
        const expandedU = Number.isFinite(num(pt.reportedU)) ? num(pt.reportedU) : num(pt.expandedU)
        const reference = Number.isFinite(num(pt.stdMean)) ? num(pt.stdMean) : num(pt.point)
        points.push(pointResult('iso', index, pt.point, unit, error, expandedU, reference, acceptance, isoPoints[index]?.verdictOverride))
      })
    } else if (Array.isArray(isoResult?.calPointSummaries)) {
      isoResult.calPointSummaries.forEach((cps: any, index: number) => {
        let worst: any = null
        for (const sr of cps.sensorResults || []) {
          if (!worst || Math.abs(num(sr.correction)) > Math.abs(num(worst.correction))) worst = sr
        }
        const maxU = Math.max(...(cps.sensorResults || []).map((sr: any) => num(sr.U)).filter(Number.isFinite), NaN)
        const error = worst ? -num(worst.correction) : NaN
        const reference = worst && Number.isFinite(num(worst.avgSTDRead)) ? num(worst.avgSTDRead) : num(cps.point)
        points.push(pointResult('iso', index, cps.point, unit, error, Number.isFinite(maxU) ? maxU : NaN, reference, acceptance, isoPoints[index]?.verdictOverride))
      })
    }
  } else {
    const rows = Array.isArray(calculation.summary) ? calculation.summary : []
    for (const key of UC_KEYS) {
      const uc = record?.[key]
      const pts: any[] = Array.isArray(uc?.calPoints) ? uc.calPoints : []
      if (!pts.length) continue
      const ucRows = rows.filter((r) => r.ucName === key)
      if (!ucRows.length) continue
      if (!unit) unit = String(uc?.std?.unit || ucRows[0]?.unit || '')
      pts.forEach((pt, index) => {
        const row = index < ucRows.length ? ucRows[index] : undefined
        if (!row) return
        const error = num(row.avgUUC) - num(row.avgSTDRead)
        const reference = Number.isFinite(num(row.avgSTDRead)) ? num(row.avgSTDRead) : parseCalibrationValue(pt?.point)
        points.push(pointResult(key, index, pt?.point, String(uc?.std?.unit || row.unit || ''), error, num(row.U), reference, acceptance, pt?.verdictOverride))
      })
    }
  }

  const autoOverall = summarizeVerdicts(points.map((p) => p.verdict))
  const overallManual = isVerdict(record?.overallVerdictOverride)
  return {
    acceptance,
    description: describeAcceptance(acceptance, unit),
    points,
    autoOverall,
    overall: overallManual ? record.overallVerdictOverride : autoOverall,
    overallManual,
  }
}

/** สร้าง $set สำหรับบันทึกผลการตัดสินลง record (เฉพาะค่าที่เปลี่ยน) */
export function buildVerdictPatch(record: any, result: AcceptanceResult): Record<string, Verdict> {
  const patch: Record<string, Verdict> = {}
  for (const p of result.points) {
    const path = p.group === 'iso' ? `isoData.calPoints.${p.index}.verdict` : `${p.group}.calPoints.${p.index}.verdict`
    const current = p.group === 'iso' ? record?.isoData?.calPoints?.[p.index]?.verdict : record?.[p.group]?.calPoints?.[p.index]?.verdict
    if (current !== p.verdict) patch[path] = p.verdict
  }
  if (record?.overallVerdict !== result.overall) patch.overallVerdict = result.overall
  return patch
}

export function findPointVerdict(result: AcceptanceResult | null | undefined, group: string, index: number): AcceptancePointResult | undefined {
  return result?.points.find((p) => p.group === group && p.index === index)
}
