import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CertNumberConfig from '@/models/CertNumberConfig'

function isValidPattern(pattern: string) {
  return pattern.includes('{num}')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'technician')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  await connectDB()
  const cfg =
    (await CertNumberConfig.findOne({ key: 'default' }).lean()) ||
    {
      key: 'default',
      pattern: '{num}/{yy}',
      startNumber: 1,
      padding: 3,
      resetByYear: true,
      certValidityMonths: 12,
      alertBeforeDays: 30,
    }
  return NextResponse.json({ config: cfg })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'technician')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const pattern = String(body?.pattern || '').trim()
  const startNumber = Number(body?.startNumber)
  const padding = Number(body?.padding)
  const resetByYear = !!body?.resetByYear
  const certValidityMonths = Number(body?.certValidityMonths)
  const alertBeforeDays = Number(body?.alertBeforeDays)

  if (!isValidPattern(pattern)) {
    return NextResponse.json({ error: 'pattern ต้องมี {num}' }, { status: 400 })
  }
  if (!Number.isFinite(startNumber) || startNumber < 0) {
    return NextResponse.json({ error: 'startNumber ไม่ถูกต้อง' }, { status: 400 })
  }
  if (!Number.isFinite(padding) || padding < 1 || padding > 8) {
    return NextResponse.json({ error: 'padding ต้องอยู่ระหว่าง 1-8' }, { status: 400 })
  }
  if (!Number.isFinite(certValidityMonths) || certValidityMonths < 1 || certValidityMonths > 120) {
    return NextResponse.json({ error: 'certValidityMonths ต้องอยู่ระหว่าง 1-120' }, { status: 400 })
  }
  if (!Number.isFinite(alertBeforeDays) || alertBeforeDays < 1 || alertBeforeDays > 365) {
    return NextResponse.json({ error: 'alertBeforeDays ต้องอยู่ระหว่าง 1-365' }, { status: 400 })
  }

  await connectDB()
  const config = await CertNumberConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        pattern,
        startNumber,
        padding,
        resetByYear,
        certValidityMonths,
        alertBeforeDays,
      },
    },
    { upsert: true, new: true }
  ).lean()

  return NextResponse.json({ config })
}
