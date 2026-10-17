import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CertNumberConfig from '@/models/CertNumberConfig'
import { ENVIRONMENT_DEFAULTS } from '@/lib/environmentCheck'

function isValidPattern(pattern: string) {
  return pattern.includes('{num}')
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  // ผู้อนุมัติอ่านได้เพื่อแสดงเกณฑ์สภาวะแวดล้อมก่อนอนุมัติ (แก้ไขได้เฉพาะ admin ใน PATCH)
  if (!session || (role !== 'admin' && role !== 'technician' && role !== 'approver')) {
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
  return NextResponse.json({ config: { ...ENVIRONMENT_DEFAULTS, ...(cfg as object) } })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  // รูปแบบเลขใบรับรองมีผลทั้งระบบ ให้แก้ได้เฉพาะผู้ดูแลระบบ
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json()
  const pattern = String(body?.pattern || '').trim()
  const startNumber = Number(body?.startNumber)
  const padding = Number(body?.padding)
  const resetByYear = !!body?.resetByYear
  const certValidityMonths = Number(body?.certValidityMonths)
  const alertBeforeDays = Number(body?.alertBeforeDays)
  const requireEnvironment = body?.requireEnvironment == null ? ENVIRONMENT_DEFAULTS.requireEnvironment : !!body.requireEnvironment
  const envNum = (key: 'envTempMin' | 'envTempMax' | 'envHumidMin' | 'envHumidMax') =>
    body?.[key] == null || body?.[key] === '' ? ENVIRONMENT_DEFAULTS[key] : Number(body[key])
  const envTempMin = envNum('envTempMin')
  const envTempMax = envNum('envTempMax')
  const envHumidMin = envNum('envHumidMin')
  const envHumidMax = envNum('envHumidMax')

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

  if (![envTempMin, envTempMax, envHumidMin, envHumidMax].every(Number.isFinite)) {
    return NextResponse.json({ error: 'ช่วงอุณหภูมิ/ความชื้นต้องเป็นตัวเลข' }, { status: 400 })
  }
  if (envTempMin > envTempMax) {
    return NextResponse.json({ error: 'อุณหภูมิต่ำสุดต้องไม่เกินอุณหภูมิสูงสุด' }, { status: 400 })
  }
  if (envHumidMin > envHumidMax || envHumidMin < 0 || envHumidMax > 100) {
    return NextResponse.json({ error: 'ความชื้นต้องอยู่ระหว่าง 0-100 และต่ำสุดไม่เกินสูงสุด' }, { status: 400 })
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
        requireEnvironment,
        envTempMin,
        envTempMax,
        envHumidMin,
        envHumidMax,
      },
    },
    { upsert: true, new: true }
  ).lean()

  return NextResponse.json({ config })
}
