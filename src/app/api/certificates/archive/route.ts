import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ArchivedCertificatePdf from '@/models/ArchivedCertificatePdf'
import CalibrationRecord from '@/models/CalibrationRecord'

function decodePdfDataUrl(dataUrl: string): Buffer | null {
  const m = dataUrl.match(/^data:application\/pdf;base64,(.+)$/)
  if (!m) return null
  try {
    return Buffer.from(m[1], 'base64')
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any)?.role
  if (role !== 'admin' && role !== 'technician' && role !== 'approver') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const recordId = String(body?.recordId || '').trim()
  const certNo = String(body?.certNo || '').trim()
  const fileDataUrl = String(body?.fileDataUrl || '')
  if (!recordId || !certNo || !fileDataUrl) {
    return NextResponse.json({ error: 'Missing recordId/certNo/fileDataUrl' }, { status: 400 })
  }
  const pdfBuffer = decodePdfDataUrl(fileDataUrl)
  if (!pdfBuffer) {
    return NextResponse.json({ error: 'Invalid PDF data url' }, { status: 400 })
  }
  if (pdfBuffer.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'PDF too large (max 8MB)' }, { status: 400 })
  }

  await connectDB()
  const record = await CalibrationRecord.findById(recordId).select('_id certNo').lean()
  if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  await ArchivedCertificatePdf.findOneAndUpdate(
    { recordId },
    {
      $set: {
        certNo,
        fileName: `calibration-${certNo || recordId}.pdf`,
        contentType: 'application/pdf',
        pdfData: pdfBuffer,
      },
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({ ok: true })
}
