import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import UserCertificate from '@/models/UserCertificate'

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
  const certs = await UserCertificate.find({ userId: params.id })
    .select('-pdfData')
    .sort({ uploadedAt: -1 })
    .lean()

  return NextResponse.json({ data: certs })
}

/** Upload a certificate PDF */
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

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }

  const MAX_SIZE = 8 * 1024 * 1024 // 8MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const cert = await UserCertificate.create({
    userId: params.id,
    fileName: file.name,
    contentType: file.type,
    pdfData: buffer,
  })

  return NextResponse.json(
    { data: { _id: cert._id, fileName: cert.fileName, uploadedAt: cert.uploadedAt } },
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
