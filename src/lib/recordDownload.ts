export type DownloadRecord = { _id: string; certNo?: string; amedNo?: string; deviceName?: string; calibratedById?: string; approvedById?: string }
export const DOCUMENT_GROUPS = [
  {key: 'certificate', label: 'ใบรับรอง'},
  {key: 'calibrator', label: 'เซอร์ผู้สอบ'},
  {key: 'approver', label: 'เซอร์ผู้อนุมัติ'},
  {key: 'standard', label: 'ใบเซอร์เครื่องมือมาตรฐาน'},
] as const
export type DocumentGroup = typeof DOCUMENT_GROUPS[number]['key']
export type DownloadDocument = { id: string; recordId: string; recordLabel: string; label: string; url?: string; path: string; unavailable?: string; loadError?: boolean; group?: DocumentGroup; documentKey?: string; usedBy?: string[]; usedAs?: string[] }
export function safeZipName(value: string) {
  return value.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '_').replace(/\.\./g, '_').trim().slice(0, 100) || 'document'
}
/** Snapshot only the visible rows; metadata requests never expand to other pages. */
export async function collectRecordDocuments(records: DownloadRecord[], getJson: (url: string) => Promise<any>) {
  const personnel = new Map<string, Promise<any>>()
  const userDocs = (id: string) => {
    if (!personnel.has(id)) personnel.set(id, getJson(`/api/users/${id}/certificates`))
    return personnel.get(id)!
  }
  const result: DownloadDocument[][] = new Array(records.length)
  let cursor = 0
  await Promise.all(Array.from({length: Math.min(4, records.length)}, async () => {
    while (cursor < records.length) {
      const index = cursor++, record = records[index]
      const recordLabel = [record.certNo || record.amedNo || record._id, record.deviceName].filter(Boolean).join(' · ')
      const docs: DownloadDocument[] = []
      const add = (key: string, label: string, url?: string, unavailable?: string, loadError = false, documentKey?: string) => {
        const group = key.startsWith('standard') ? 'standard' : key.startsWith('calibrator') ? 'calibrator' : key.startsWith('approver') ? 'approver' : 'certificate'
        const groupLabel = DOCUMENT_GROUPS.find(item => item.key === group)!.label
        docs.push({id: `${record._id}:${key}`, recordId: record._id, recordLabel, label, url, unavailable, loadError, group, documentKey, usedBy: [recordLabel], usedAs: [groupLabel], path: `${groupLabel}/${record._id}_${safeZipName(key)}_${safeZipName(label)}.pdf`})
      }
      add('certificate', `ใบรับรอง · ${recordLabel}`,  `/api/certificates/${record._id}?download=1`)
      for (const [key, label, userId] of [['calibrator','เซอร์ผู้สอบ',record.calibratedById], ['approver','เซอร์ผู้อนุมัติ',record.approvedById]]) {
        if (!userId) { add(key!, label!, undefined, 'ยังไม่มีข้อมูลบุคคล'); continue }
        try {
          const {data} = await userDocs(userId)
          if (!Array.isArray(data)) throw Error('Invalid metadata')
          if (!data.length) add(key!, label!, undefined, 'ไม่มีไฟล์แนบ')
          for (const cert of data) add(`${key}-${cert._id}`, `${label} · ${cert.fileName || 'PDF'}`, `/api/users/${userId}/certificates/${cert._id}`)
        } catch { add(key!, label!, undefined, 'โหลดรายการไม่สำเร็จ กรุณาลองใหม่', true) }
      }
      try {
        const {data} = await getJson(`/api/records/${record._id}/standard-certificates`)
        if (!Array.isArray(data)) throw Error('Invalid metadata')
        for (const standard of data) add(`standard-${standard.slot}`, `มาตรฐาน ${standard.slot.toUpperCase()} · ${standard.no || standard.name || ''} · ${standard.certNo || 'ไม่มีเลขเซอร์'}`, standard.hasPdf ? `/api/records/${record._id}/standard-certificates?slot=${standard.slot}` : undefined, standard.hasPdf ? undefined : 'ไม่มี PDF ที่ตรงกัน', false, standard.documentKey)
      } catch { add('standards-unavailable', 'เซอร์เครื่องมือมาตรฐาน', undefined, 'โหลดรายการไม่สำเร็จ กรุณาลองใหม่', true) }
      result[index] = docs
    }
  }))
  const unique = new Map<string, DownloadDocument>()
  const all = result.flat()
  for (const group of DOCUMENT_GROUPS) {
    for (const doc of all.filter(item => item.group === group.key)) {
      const key = doc.documentKey || doc.url || doc.id
      const existing = unique.get(key)
      if (existing) {
        existing.usedBy = Array.from(new Set([...(existing.usedBy || []), doc.recordLabel]))
        existing.usedAs = Array.from(new Set([...(existing.usedAs || []), ...(doc.usedAs || [])]))
      } else unique.set(key, doc)
    }
  }
  return Array.from(unique.values())
}

export async function downloadDocumentFiles(documents: DownloadDocument[], getBytes: (url: string) => Promise<Uint8Array>, progress: (done: number, total: number) => void) {
  const files: Record<string, Uint8Array> = {}
  let totalBytes = 0
  for (let index = 0; index < documents.length; index++) {
    const doc = documents[index]
    if (!doc.url) throw new Error(`ไม่มีไฟล์: ${doc.label}`)
    const bytes = await getBytes(doc.url)
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error(`ไฟล์ไม่ใช่ PDF: ${doc.label} (${doc.recordLabel})`)
    totalBytes += bytes.byteLength
    if (totalBytes > 250 * 1024 * 1024) throw new Error('ไฟล์ที่เลือกรวมกันเกิน 250 MB กรุณาเลือกดาวน์โหลดทีละชุด')
    files[doc.path] = bytes
    progress(index + 1, documents.length)
  }
  return files
}
