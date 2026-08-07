import CertNumberConfig from '@/models/CertNumberConfig'

export async function getRecalibrationSettings() {
  const cfg = await CertNumberConfig.findOne({ key: 'default' })
    .select('certValidityMonths alertBeforeDays')
    .lean()
  const certValidityMonths = Number.isFinite(Number((cfg as any)?.certValidityMonths))
    ? Math.max(1, Number((cfg as any)?.certValidityMonths))
    : 12
  const alertBeforeDays = Number.isFinite(Number((cfg as any)?.alertBeforeDays))
    ? Math.max(1, Number((cfg as any)?.alertBeforeDays))
    : 30
  return { certValidityMonths, alertBeforeDays }
}

export function calcRecalibrationDates(now: Date, certValidityMonths: number, alertBeforeDays: number) {
  const dueBoundary = new Date(now)
  dueBoundary.setMonth(dueBoundary.getMonth() - certValidityMonths)

  const expiringStart = new Date(dueBoundary)
  expiringStart.setDate(expiringStart.getDate() + 1)

  const expiringEnd = new Date(dueBoundary)
  expiringEnd.setDate(expiringEnd.getDate() + alertBeforeDays)

  return { dueBoundary, expiringStart, expiringEnd }
}
