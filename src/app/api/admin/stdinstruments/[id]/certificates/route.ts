import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StdInstrumentCert from '@/models/StdInstrumentCert'

async function requireAdmin() {
  const s = await getServerSession(authOptions)
  if (!s || (s.user as { role?: string }).role !== 'admin') return null
  return s
}

/** List certificates for a standard instrument (metadata only) */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const certs = await StdInstrumentCert.find({ instrumentRefId: params.id })
    .select('-pdfData')
    .sort({ year: -1 })
    .lean()
  return NextResponse.json({ data: certs })
}

/** Upload a certificate PDF for a year */
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
  const year = Number(formData.get('year'))
  const certNo = (formData.get('certNo') as string | null) || undefined
  const expiryDate = formData.get('expiryDate') as string | null
  const isLatest = formData.get('isLatest') === 'true'

  if (!file || !year) {
    return NextResponse.json({ error: 'file and year required' }, { status: 400 })
  }
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // If marking as latest, unmark others
  if (isLatest) {
    await StdInstrumentCert.updateMany(
      { instrumentRefId: params.id },
      { $set: { isLatest: false } }
    )
  }

  const cert = await StdInstrumentCert.findOneAndUpdate(
    { instrumentRefId: params.id, year },
    {
      $set: {
        fileName: file.name,
        certNo,
        pdfData: buffer,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        isLatest,
        uploadedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  )

  return NextResponse.json(
    { data: { _id: cert._id, year: cert.year, certNo: cert.certNo, fileName: cert.fileName, isLatest: cert.isLatest, expiryDate: cert.expiryDate } },
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
  const r = await StdInstrumentCert.findOneAndDelete({ _id: certId, instrumentRefId: params.id })
  if (!r) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
