import mongoose from 'mongoose'
import { getCertificateTextConfig } from '@/lib/certificateTextService'
import { defaultCertificateTexts, type CertificateTexts } from '@/lib/certificateTexts'
import React from 'react'
import path from 'node:path'
import { Font, renderToBuffer } from '@react-pdf/renderer'
import CalibrationPDF from '@/components/CalibrationPDF'
import { calculateRecord } from '@/lib/calculateRecord'
import User from '@/models/User'

let fontsRegistered = false

/** Uses the same identity and approval rules as the authenticated signatures API. */
export async function getCertificateSignatures(record: any) {
  let calibratorSignature: string | null = null
  if (record.calibratedById) {
    const user = await User.findById(record.calibratedById).select('signaturePng').lean()
    calibratorSignature = (user as any)?.signaturePng || null
  }
  const name = String(record.calibrate || '').trim()
  if (!calibratorSignature && name) {
    const user = await User.findOne({ $or: [{ fullName: name }, { name }, { fullNameEn: name }] }).select('signaturePng').lean()
    calibratorSignature = (user as any)?.signaturePng || null
  }
  let approverSignature: string | null = null
  if (record.approvalStatus === 'approved' && record.approvedById) {
    const user = await User.findById(record.approvedById).select('signaturePng').lean()
    approverSignature = (user as any)?.signaturePng || null
  }
  return { calibratorSignature, approverSignature }
}

/** Caller establishes the database connection. All PDF assets are read locally. */
export async function renderCertificatePdf(record: any, textOverrides?: CertificateTexts): Promise<Buffer> {
  if (!fontsRegistered) {
    Font.register({ family: 'NotoSansThai', fonts: [
      { src: path.join(process.cwd(), 'public/fonts/noto-sans-thai-400.woff'), fontWeight: 400 },
      { src: path.join(process.cwd(), 'public/fonts/noto-sans-thai-700.woff'), fontWeight: 700 },
    ] })
    fontsRegistered = true
  }
  const texts = textOverrides || (mongoose.connection.readyState === 1 ? (await getCertificateTextConfig()).texts : defaultCertificateTexts)
  const [calculation, signatures] = await Promise.all([calculateRecord(record), getCertificateSignatures(record)])
  if (record.calibrationType === 'iso' && record.isoData?.calPoints?.length) {
    const hasResults = calculation.isoResult?.calPointResults?.length ||
      calculation.isoResult?.calPointSummaries?.some((point: any) => point.sensorResults?.length)
    if (!hasResults) throw new Error('ISO calculation produced no results for the recorded calibration points')
  }
  return renderToBuffer(<CalibrationPDF
    texts={texts}
    record={record}
    summaryRows={calculation.summary || null}
    isoResult={calculation.isoResult}
    {...signatures}
    decimals={1}
    logoSrc={path.join(process.cwd(), 'public/logo.jpg')}
  />)
}
