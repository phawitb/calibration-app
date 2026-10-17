import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import RecordAttachment, { ATTACHMENT_KINDS, ATTACHMENT_MAX_SIZE, sniffAttachmentType } from '@/models/RecordAttachment'
import { resolveAttachmentAccess } from '@/lib/recordAttachmentAccess'
import { logActivity } from '@/lib/activityLog'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** GET: รายการไฟล์แนบของ record (metadata เท่านั้น) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const access = await resolveAttachmentAccess(session.user, params.id, 'view')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const items = await RecordAttachment.find({ recordId: params.id })
    .select('-data')
    .sort({ createdAt: -1 })
    .lean()
  const role = (session.user as any)?.role
  const canWrite = role === 'admin' || role === 'technician'
    ? (await resolveAttachmentAccess(session.user, params.id, 'write')).ok
    : false
  return NextResponse.json({ data: items, canWrite }, { headers: NO_STORE })
}

/** POST multipart: file (pdf/png/jpeg ≤ 8 MB), kind?, note? */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await connectDB()
  const access = await resolveAttachmentAccess(session.user, params.id, 'write')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง (ต้องเป็น multipart/form-data)' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'กรุณาเลือกไฟล์' }, { status: 400 })
  if (file.size > ATTACHMENT_MAX_SIZE) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 8 MB' }, { status: 400 })
  }
  const kindRaw = String(formData.get('kind') || 'external_result')
  const kind = (ATTACHMENT_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : 'external_result'
  const note = String(formData.get('note') || '').trim().slice(0, 500)

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!buffer.length) return NextResponse.json({ error: 'ไฟล์ว่างเปล่า' }, { status: 400 })
  const contentType = sniffAttachmentType(buffer)
  if (!contentType) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ PDF, PNG หรือ JPEG เท่านั้น' }, { status: 400 })
  }

  const fileName = String(file.name || 'attachment')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_')
    .trim()
    .slice(0, 200) || 'attachment'

  const user = session.user as any
  const created = await RecordAttachment.create({
    recordId: params.id,
    kind,
    fileName,
    contentType,
    size: buffer.length,
    data: buffer,
    uploadedBy: String(user.username || ''),
    uploadedById: user.id ? String(user.id) : undefined,
    note: note || undefined,
  })
  await logActivity(req, user, 'attachment_upload', {
    targetType: 'record',
    targetId: params.id,
    detail: `${fileName} (${kind}, ${Math.round(buffer.length / 1024)} KB)`,
  })

  return NextResponse.json({
    data: {
      _id: created._id,
      recordId: created.recordId,
      kind: created.kind,
      fileName: created.fileName,
      contentType: created.contentType,
      size: created.size,
      uploadedBy: created.uploadedBy,
      note: created.note,
      createdAt: created.createdAt,
    },
  }, { status: 201, headers: NO_STORE })
}
