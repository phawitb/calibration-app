import {NextRequest, NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {connectDB} from '@/lib/mongodb'
import {getCertificateTextConfig} from '@/lib/certificateTextService'
import {validateCertificateTexts} from '@/lib/certificateTexts'
import CertificateTextConfig from '@/models/CertificateTextConfig'
export async function GET() {
  if (!await getServerSession(authOptions)) return NextResponse.json({error:'Unauthorized'},{status:401})
  await connectDB()
  return NextResponse.json(await getCertificateTextConfig(), {headers:{'Cache-Control':'private, no-store'}})
}
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user || !['admin','technician'].includes(user.role)) return NextResponse.json({error:'Forbidden'},{status:403})
  try {
    const body = await req.json(), texts = validateCertificateTexts(body.texts)
    if (!Number.isInteger(body.revision) || body.revision < 0) return NextResponse.json({error:'รุ่นข้อมูลไม่ถูกต้อง'},{status:400})
    await connectDB()
    if (body.revision === 0) await CertificateTextConfig.create({key:'default',texts,revision:1,changedBy:user.id})
    else {
      const saved = await CertificateTextConfig.findOneAndUpdate({key:'default',revision:body.revision},{$set:{texts,changedBy:user.id},$inc:{revision:1}})
      if (!saved) return NextResponse.json({error:'มีการแก้ไขข้อความแล้ว กรุณาโหลดข้อมูลใหม่'},{status:409})
    }
    return NextResponse.json(await getCertificateTextConfig())
  } catch(error:any) {
    return NextResponse.json({error:error.code===11000 ? 'มีการแก้ไขข้อความแล้ว กรุณาโหลดข้อมูลใหม่' : error.message || 'บันทึกไม่สำเร็จ'},{status:error.code===11000?409:400})
  }
}
