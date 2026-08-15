import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import UserCertificate from '@/models/UserCertificate'
import { inlineContentDisposition } from '@/lib/contentDisposition'

/** Download a specific certificate PDF */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; certId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const cert = await UserCertificate.findOne({ _id: params.certId, userId: params.id })
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(cert.pdfData, {
    headers: {
      'Content-Type': cert.contentType || 'application/pdf',
      'Content-Disposition': inlineContentDisposition(cert.fileName),
    },
  })
}
