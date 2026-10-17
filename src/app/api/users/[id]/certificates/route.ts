import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import UserCertificate from '@/models/UserCertificate'
import { canViewUserCertificates } from '@/lib/userCertificateAccess'
import { ATTACHMENT_LABEL, ATTACHMENT_MAX_BYTES, declaredTypeMatches, sniffAttachmentType } from '@/lib/attachmentTypes'

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') return null
  return s
}

/** List certificates for a user (metadata only) */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  if (!(await canViewUserCertificates(session.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const certs = await UserCertificate.find({ userId: params.id })
    .select('-pdfData')
    .sort({ uploadedAt: -1 })
    .lean()

  return NextResponse.json({ data: certs })
}

/** Upload a certificate file (PDF / PNG / JPEG) */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 8 MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const contentType = sniffAttachmentType(buffer)
  if (!contentType || !declaredTypeMatches(file.type, contentType)) {
    return NextResponse.json({ error: `รองรับเฉพาะไฟล์ ${ATTACHMENT_LABEL}` }, { status: 400 })
  }
  const cert = await UserCertificate.create({
    userId: params.id,
    fileName: String(file.name || 'certificate').slice(0, 250),
    contentType,
    pdfData: buffer,
  })

  return NextResponse.json(
    { data: { _id: cert._id, fileName: cert.fileName, contentType: cert.contentType, uploadedAt: cert.uploadedAt } },
    { status: 201 }
  )
}

/** Delete a certificate */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const certId = searchParams.get('certId')
  if (!certId) return NextResponse.json({ error: 'certId required' }, { status: 400 })

  await connectDB()
  const r = await UserCertificate.findOneAndDelete({ _id: certId, userId: params.id })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
