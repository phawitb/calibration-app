import AmedCertHistory from '@/models/AmedCertHistory'

/** อาร์เมด = คีย์ — บันทึกคู่ (amedNo, certNo) ต่อ record เมื่อมีข้อมูล */
export async function registerAmedCertForRecord(amedNo: unknown, certNo: unknown, recordId: string) {
  const a = String(amedNo || '').trim()
  const c = String(certNo || '').trim()
  if (!a || !c || !recordId) return
  try {
    await AmedCertHistory.findOneAndUpdate(
      { amedNo: a, certNo: c },
      { $set: { recordId, updatedAt: new Date() } },
      { upsert: true, new: true }
    )
  } catch {
    // duplicate race — ignore
  }
}
