import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import UserCertificate from '@/models/UserCertificate'
import { inlineContentDisposition } from '@/lib/contentDisposition'
import { canViewUserCertificates } from '@/lib/userCertificateAccess'
import { ATTACHMENT_TYPES } from '@/lib/attachmentTypes'

/** Download a specific certificate file (PDF / PNG / JPEG) */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; certId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  if (!(await canViewUserCertificates(session.user, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const cert = await UserCertificate.findOne({ _id: params.certId, userId: params.id })
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(cert.pdfData, {
    headers: {
      'Content-Type': (ATTACHMENT_TYPES as readonly string[]).includes(cert.contentType) ? cert.contentType : 'application/pdf',
      'Content-Disposition': inlineContentDisposition(cert.fileName),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
