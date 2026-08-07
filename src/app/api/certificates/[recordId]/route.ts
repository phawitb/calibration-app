import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import ArchivedCertificatePdf from '@/models/ArchivedCertificatePdf'
import mongoose from 'mongoose'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

async function getUnitVariants(inputRaw: unknown) {
  const input = String(inputRaw || '').trim()
  if (!input) return []
  const db = mongoose.connection.db
  if (!db) return [input]
  const rows = await db.collection('unitnames')
    .find({}, { projection: { name: 1, thaiName: 1 } })
    .limit(5000)
    .toArray()
  const norm = input.toLowerCase()
  for (const row of rows) {
    const en = String((row as any)?.name || '').trim()
    const th = String((row as any)?.thaiName || '').trim()
    const label = formatHospitalUnitLabel(en, th)
    const keys = [en, th, label].map((v) => v.toLowerCase()).filter(Boolean)
    if (keys.includes(norm)) return Array.from(new Set([label, en, th].filter(Boolean)))
  }
  return [input]
}

export async function GET(
  req: NextRequest,
  { params }: { params: { recordId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const recordId = String(params.recordId || '').trim()
  const record = await CalibrationRecord.findById(recordId).select('_id certNo unitName').lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit
  if (role === 'hospital_user' && hospitalUnit) {
    const allowed = await getUnitVariants(hospitalUnit)
    if (!allowed.includes(String((record as any).unitName || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const archived = await ArchivedCertificatePdf.findOne({ recordId }).lean()
  if (!archived || !(archived as any).pdfData) {
    const previewUrl = new URL(`/records/${recordId}/pdf`, req.url)
    return NextResponse.redirect(previewUrl)
  }

  const certNo = String((archived as any).certNo || (record as any).certNo || recordId)
  const fileName = String((archived as any).fileName || `calibration-${certNo}.pdf`)
  const contentType = String((archived as any).contentType || 'application/pdf')
  const dataBuffer = Buffer.from((archived as any).pdfData)

  return new NextResponse(dataBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(dataBuffer.length),
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, max-age=60',
    },
  })
}
