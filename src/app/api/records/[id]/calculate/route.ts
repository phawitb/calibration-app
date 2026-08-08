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
    const isoResult = calculateIsoRecord(record)
    return NextResponse.json({ recordId: params.id, calibrationType: 'iso', isoResult })
  }

  // SbCal records: existing calculation
  const ucResults = calculateAllUcComponents(record, formulaMap)
  const summary = buildSummaryTable(ucResults)

  return NextResponse.json({ recordId: params.id, calibrationType: 'sbcal', ucResults, summary })
}
