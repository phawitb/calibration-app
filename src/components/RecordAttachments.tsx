'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Attachment = {
  _id: string
  kind: 'external_result' | 'other'
  fileName: string
  contentType: string
  size: number
  uploadedBy: string
  note?: string
  createdAt: string
}

const KIND_LABELS: Record<Attachment['kind'], string> = {
  external_result: 'ผลสอบเทียบภายนอก',
  other: 'ไฟล์แนบอื่น ๆ',
}

const MAX_SIZE = 8 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** ผลสอบเทียบภายนอก / ไฟล์แนบ ประจำ record (TOR 1.2.1.17) */
export default function RecordAttachments({ recordId }: { recordId: string }) {
  const [items, setItems] = useState<Attachment[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [kind, setKind] = useState<Attachment['kind']>('external_result')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/records/${recordId}/attachments`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'โหลดไฟล์แนบไม่สำเร็จ')
      setItems(Array.isArray(json.data) ? json.data : [])
      setCanWrite(!!json.canWrite)
    } catch (e: any) {
      setError(e?.message || 'โหลดไฟล์แนบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [recordId])

  useEffect(() => { load() }, [load])

  const upload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) { toast.error('กรุณาเลือกไฟล์'); return }
    if (file.size > MAX_SIZE) { toast.error('ไฟล์ใหญ่เกิน 8 MB'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      if (note.trim()) form.append('note', note.trim())
      const res = await fetch(`/api/records/${recordId}/attachments`, { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'อัปโหลดไม่สำเร็จ')
      toast.success('แนบไฟล์แล้ว')
      setFile(null)
      setNote('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (item: Attachment) => {
    if (!window.confirm(`ลบไฟล์ "${item.fileName}" ?`)) return
    try {
      const res = await fetch(`/api/records/${recordId}/attachments/${item._id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'ลบไม่สำเร็จ')
      toast.success('ลบไฟล์แล้ว')
      setItems((prev) => prev.filter((x) => x._id !== item._id))
    } catch (err: any) {
      toast.error(err?.message || 'ลบไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="section-title">ผลสอบเทียบภายนอก / ไฟล์แนบ</h2>
        <p className="text-sm text-gray-600 mb-3">
          แนบผลสอบเทียบจากหน่วยงานภายนอกหรือเอกสารประกอบของรายการนี้ (PDF, PNG, JPEG ไม่เกิน 8 MB ต่อไฟล์)
        </p>
        {canWrite && (
          <form onSubmit={upload} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm mb-1 text-gray-600">ไฟล์</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg"
                className="input-field file:mr-3 file:rounded file:border-0 file:bg-military-100 file:px-3 file:py-1 file:text-sm file:text-military-800"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                disabled={uploading}
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-600">ประเภท</label>
              <select className="input-field" value={kind} onChange={(e) => setKind(e.target.value as Attachment['kind'])} disabled={uploading}>
                <option value="external_result">{KIND_LABELS.external_result}</option>
                <option value="other">{KIND_LABELS.other}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1 text-gray-600">หมายเหตุ</label>
              <input className="input-field" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ห้องปฏิบัติการ / เลขที่ใบรับรอง" disabled={uploading} />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button type="submit" className="btn-primary" disabled={uploading || !file}>{uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดไฟล์แนบ'}</button>
            </div>
          </form>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="px-4 py-4 text-sm text-gray-500">กำลังโหลด…</p>
        ) : error ? (
          <p role="alert" className="px-4 py-4 text-sm text-red-600">{error}</p>
        ) : !items.length ? (
          <p className="px-4 py-4 text-sm text-gray-500">ยังไม่มีไฟล์แนบสำหรับรายการนี้</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-military-100 px-2 py-0.5 text-xs font-medium text-military-800">{KIND_LABELS[item.kind] || item.kind}</span>
                    <span className="font-medium text-gray-800 break-all">{item.fileName}</span>
                    <span className="text-xs text-gray-500">{formatSize(item.size)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    โดย {item.uploadedBy} · {new Date(item.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    {item.note && <> · {item.note}</>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/records/${recordId}/attachments/${item._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-military-300 px-2 py-1 text-xs font-medium text-military-700 hover:bg-military-50"
                  >
                    เปิดไฟล์
                  </a>
                  {canWrite && (
                    <button type="button" onClick={() => remove(item)} className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      ลบ
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
