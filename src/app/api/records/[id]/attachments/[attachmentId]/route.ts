import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import RecordAttachment from '@/models/RecordAttachment'
import { resolveAttachmentAccess } from '@/lib/recordAttachmentAccess'
import { inlineContentDisposition } from '@/lib/contentDisposition'
import { pdfBytes } from '@/lib/pdfBytes'
import { logActivity } from '@/lib/activityLog'

type Params = { params: { id: string; attachmentId: string } }

/** GET: เปิดไฟล์แนบ (inline) */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!mongoose.isValidObjectId(params.attachmentId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await connectDB()
  const access = await resolveAttachmentAccess(session.user, params.id, 'view')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const attachment: any = await RecordAttachment.findOne({ _id: params.attachmentId, recordId: params.id })
    .select('+data')
    .lean()
  if (!attachment?.data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let bytes: Buffer
  try {
    bytes = pdfBytes(attachment.data)
  } catch {
    return NextResponse.json({ error: 'ไฟล์แนบเสียหาย' }, { status: 500 })
  }
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': String(attachment.contentType || 'application/octet-stream'),
      'Content-Length': String(bytes.length),
      'Content-Disposition': inlineContentDisposition(attachment.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

/** DELETE: ลบไฟล์แนบ (admin / technician เจ้าของรายการ) */
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!mongoose.isValidObjectId(params.attachmentId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await connectDB()
  const access = await resolveAttachmentAccess(session.user, params.id, 'write')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const removed: any = await RecordAttachment.findOneAndDelete({ _id: params.attachmentId, recordId: params.id })
    .select('-data')
    .lean()
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logActivity(req, session.user as any, 'attachment_delete', {
    targetType: 'record',
    targetId: params.id,
    detail: String(removed.fileName || params.attachmentId),
  })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
}
