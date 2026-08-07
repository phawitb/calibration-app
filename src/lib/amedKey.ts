import CalibrationRecord from '@/models/CalibrationRecord'

/**
 * คีย์ย่อยต่ออาร์เมด: เช่น 1.1, 1.2, 1.3
 */
export async function generateNextAmedCertKey(amedNoRaw: unknown): Promise<string> {
  const amedNo = String(amedNoRaw || '').trim()
  if (!amedNo) return ''

  const rows = await CalibrationRecord.find({
    $expr: { $eq: [{ $toString: { $ifNull: ['$amedNo', ''] } }, amedNo] },
  })
    .select('amedCertKey')
    .lean()

  let maxSeq = 0
  for (const r of rows as any[]) {
    const key = String(r?.amedCertKey || '').trim()
    const m = key.match(new RegExp(`^${amedNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d+)$`))
    if (!m) continue
    const n = Number(m[1])
    if (Number.isFinite(n) && n > maxSeq) maxSeq = n
  }
  return `${amedNo}.${maxSeq + 1}`
}
