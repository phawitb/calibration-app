import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ArchivedCertificatePdf from '@/models/ArchivedCertificatePdf'
import CalibrationRecord from '@/models/CalibrationRecord'
import mongoose from 'mongoose'

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
  try {
    const expectedRevision = Number(body?.certificateRevision ?? 0)
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || !body?.recordUpdatedAt || Number.isNaN(new Date(body.recordUpdatedAt).getTime())) {
      return NextResponse.json({ error: 'กรุณาโหลดข้อมูลใบเซอร์ใหม่' }, { status: 409 })
    }
    let stale = false
    await mongoose.connection.transaction(async transaction => {
      // Lock the source revision so a simultaneous reference update cannot be overwritten.
      const record = await CalibrationRecord.findOneAndUpdate({
        _id: recordId, certNo, updatedAt: new Date(body.recordUpdatedAt),
        $expr: { $eq: [{ $ifNull: ['$certificateRevision', 0] }, expectedRevision] },
      }, { $inc: { certificateArchiveTick: 1 } }, { new: true, session: transaction, timestamps: false }).lean()
      if (!record) { stale = true; return }
      await ArchivedCertificatePdf.findOneAndUpdate({ recordId }, { $set: {
        certNo, fileName: `calibration-${certNo || recordId}.pdf`, contentType: 'application/pdf',
        pdfData: pdfBuffer, certificateRevision: expectedRevision,
      } }, { upsert: true, new: true, session: transaction })
    })
    if (stale) return NextResponse.json({ error: 'ข้อมูลใบเซอร์เปลี่ยนแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Certificate archive failed', error)
    return NextResponse.json({ error: 'จัดเก็บใบเซอร์ไม่สำเร็จ' }, { status: 500 })
  }
}
