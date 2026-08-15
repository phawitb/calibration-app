import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import CalculationFormula from '@/models/CalculationFormula'
import {
  calculateAllUcComponents,
  calculateIsoRecord,
  buildSummaryTable,
  STANDARD_FORMULA,
  FormulaConfig,
} from '@/lib/uncertainty'
import IsoMethodTemplate from '@/models/IsoMethodTemplate'
import { applyIsoMethodSeedOverlay } from '@/lib/isoMethodSeeds'
import { calculateIsoUncertainty, type IsoCalcInput } from '@/lib/isoUncertainty'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'hospital_user' && hospitalUnit && String((record as any).unitName || '') !== String(hospitalUnit)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ucKeys = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
  const formulaMap: Partial<Record<string, FormulaConfig>> = {}

  const formulaIds = new Set<string>()
  for (const key of ucKeys) {
    const fid = String((record as any)?.[key]?.formulaId || '')
    if (fid && fid !== 'standard') formulaIds.add(fid)
  }

  const formulaDocs = formulaIds.size > 0
    ? await CalculationFormula.find({ _id: { $in: Array.from(formulaIds) }, isActive: true }).lean()
    : []
  const formulaById = new Map(formulaDocs.map((f: any) => [String(f._id), f]))

  for (const key of ucKeys) {
    const uc = (record as any)?.[key]
    if (!uc) continue
    const fid = String(uc?.formulaId || '')
    if (!fid || fid === 'standard') {
      formulaMap[key] = STANDARD_FORMULA
      continue
    }
    const doc = formulaById.get(fid)
    formulaMap[key] = doc
      ? {
          code: String(doc.code || 'standard'),
          name: String(doc.name || 'สูตร'),
          confidenceLevel: Number(doc.confidenceLevel ?? 0.9545),
          divisorNormal: Number(doc.divisorNormal ?? 2),
          divisorRect: Number(doc.divisorRect ?? 1.732050808),
          numReadings: Number(doc.numReadings ?? 4),
          forceK: doc.forceK == null ? null : Number(doc.forceK),
        }
      : STANDARD_FORMULA
  }

  // ISO records: use ISO-specific calculation
  if ((record as any).calibrationType === 'iso') {
    const isoMethodCode = (record as any).isoMethodCode
    const isoData = (record as any).isoData || {}

    // Try to load method template from DB for advanced calculation
    const methodTemplate = isoMethodCode
      ? await IsoMethodTemplate.findOne({ code: isoMethodCode, isActive: true }).lean()
      : null

    if (methodTemplate) {
      const template = applyIsoMethodSeedOverlay(methodTemplate as any)
      const toNumber = (value: any) => {
        if (value === '' || value == null || (typeof value === 'string' && !value.trim())) return null
        const number = Number(value)
        return Number.isFinite(number) ? number : null
      }
      const toMatrix = (matrix: any) => Array.isArray(matrix)
        ? matrix.map((row: any) => Array.isArray(row) ? row.map(toNumber) : [toNumber(row)])
        : []
      const toVector = (values: any) => Array.isArray(values) ? values.map(toNumber).filter((v: number | null): v is number => v !== null) : []
      // Use new universal ISO engine with method template
      const calcInput: IsoCalcInput = {
        methodTemplate: template as any,
        calPoints: (isoData.calPoints || []).map((cp: any) => ({
          point: Number(cp.point ?? 0),
          uucSetting: cp.uucSetting,
          sensorReadings: toMatrix(cp.sensorReadings),
          stdReadings: cp.stdReadings ? toMatrix(cp.stdReadings) : undefined,
          uucReadings: toVector(cp.uucReadings),
          tNoLoad: Number.isFinite(Number(cp.tNoLoad)) ? Number(cp.tNoLoad) : undefined,
          verticalReadings: cp.verticalReadings
            ? {
                center: toVector(cp.verticalReadings.center),
                top: toVector(cp.verticalReadings.top),
                bottom: toVector(cp.verticalReadings.bottom),
              }
            : undefined,
          standardCorrection: cp.standardCorrection,
        })),
        calRefPoints: (isoData.calRefPoints || []).map((cp: any) => ({
          point: Number(cp.point ?? 0),
          sensorReadings: toMatrix(cp.sensorReadings),
          stdReadings: cp.stdReadings ? toMatrix(cp.stdReadings) : undefined,
          uucReadings: toVector(cp.uucReadings),
          standardCorrection: cp.standardCorrection,
        })),
        std1: (record as any).std1 || {},
        uucResolution: Number(isoData.uucResolution ?? isoData.methodFields?.uucResolution ?? 0),
        probeCorrections: isoData.probeCorrections,
        methodFields: isoData.methodFields || {},
        envTemp: isoData.envTemp,
        envTempScope: template.envTempScope,
        confidenceLevel: 0.9545,
        timeCheck: isoData.timeCheck,
      }
      const isoResult = calculateIsoUncertainty(calcInput)
      return NextResponse.json({
        recordId: params.id,
        calibrationType: 'iso',
        isoResult,
        methodTemplate: {
          code: template.code,
          name: template.name,
          nameTh: template.nameTh,
          measurementPattern: template.measurementPattern,
          unit: template.unit,
        },
      })
    }

    // Fallback: use legacy ISO calculation (for records without method template)
    const isoResult = calculateIsoRecord(record)
    return NextResponse.json({ recordId: params.id, calibrationType: 'iso', isoResult })
  }

  // SbCal records: existing calculation
  const ucResults = calculateAllUcComponents(record, formulaMap)
  const summary = buildSummaryTable(ucResults)

  return NextResponse.json({ recordId: params.id, calibrationType: 'sbcal', ucResults, summary })
}
