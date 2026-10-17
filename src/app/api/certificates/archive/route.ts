import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import ArchivedCertificatePdf from '@/models/ArchivedCertificatePdf'
import CalibrationRecord from '@/models/CalibrationRecord'
import { renderCertificatePdf } from '@/lib/renderCertificatePdf'
import mongoose from 'mongoose'

export const maxDuration = 60

/**
 * จัดเก็บใบรับรองฉบับทางการของ record
 * เซิร์ฟเวอร์เป็นผู้สร้าง PDF เองจากข้อมูลใน DB เสมอ ไม่รับไฟล์จาก client
 * (ฟิลด์ fileDataUrl ที่ client รุ่นเก่าส่งมาจะถูกละไว้)
 */
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
  if (!recordId || !certNo || !mongoose.isValidObjectId(recordId)) {
    return NextResponse.json({ error: 'Missing recordId/certNo' }, { status: 400 })
  }

  await connectDB()
  try {
    const expectedRevision = Number(body?.certificateRevision ?? 0)
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || !body?.recordUpdatedAt || Number.isNaN(new Date(body.recordUpdatedAt).getTime())) {
      return NextResponse.json({ error: 'กรุณาโหลดข้อมูลใบเซอร์ใหม่' }, { status: 409 })
    }
    const recordUpdatedAt = new Date(body.recordUpdatedAt)
    const matchRecord = {
      _id: recordId, certNo, updatedAt: recordUpdatedAt,
      $expr: { $eq: [{ $ifNull: ['$certificateRevision', 0] }, expectedRevision] },
    }

    // ตรวจก่อนว่า record ตรงกับ revision ที่ client เห็น แล้วค่อยสร้าง PDF จากข้อมูลจริง
    const source = await CalibrationRecord.findOne(matchRecord).lean()
    if (!source) return NextResponse.json({ error: 'ข้อมูลใบเซอร์เปลี่ยนแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    if ((source as any).approvalStatus !== 'approved') {
      return NextResponse.json({ error: 'จัดเก็บได้เฉพาะใบเซอร์ที่อนุมัติแล้ว' }, { status: 409 })
    }
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await renderCertificatePdf(source)
    } catch (renderError) {
      console.error('Certificate render failed', renderError)
      return NextResponse.json({ error: 'สร้างใบรับรอง PDF ไม่สำเร็จ' }, { status: 422 })
    }

    let stale = false
    await mongoose.connection.transaction(async transaction => {
      // Lock the source revision so a simultaneous reference update cannot be overwritten.
      const record = await CalibrationRecord.findOneAndUpdate(
        matchRecord,
        { $inc: { certificateArchiveTick: 1 } },
        { new: true, session: transaction, timestamps: false }
      ).lean()
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
