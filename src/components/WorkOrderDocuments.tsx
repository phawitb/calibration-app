'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
export default function WorkOrderDocuments({
  orderId,
  editable = false,
  allowUpload = true,
  disabled = false,
  title = 'เอกสารคำสั่ง PDF',
}: {
  orderId: string
  editable?: boolean
  allowUpload?: boolean
  disabled?: boolean
  title?: string
}) {
  const [files, setFiles] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/orders/${orderId}/documents`)
      const j = await r.json()
      if (!r.ok) throw Error(j.error)
      setFiles(j.data)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [orderId])
  useEffect(() => {
    setFiles([])
    load()
  }, [load])
  async function upload(selected: FileList | null) {
    if (!selected) return
    setBusy(true)
    for (const file of Array.from(selected)) {
      try {
        if (file.type !== 'application/pdf' || file.size > 8 * 1024 * 1024)
          throw Error('เลือก PDF ขนาดไม่เกิน 8 MB ต่อไฟล์')
        const form = new FormData()
        form.append('file', file)
        const r = await fetch(`/api/orders/${orderId}/documents`, {
            method: 'POST',
            body: form,
          }),
          j = await r.json()
        if (!r.ok) throw Error(j.error)
        toast.success(`บันทึก ${file.name} แล้ว`)
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`)
      }
    }
    await load()
    setBusy(false)
  }
  async function remove(id: string) {
    if (!confirm('ลบไฟล์ PDF นี้?')) return
    setBusy(true)
    try {
      const r = await fetch(`/api/orders/${orderId}/documents/${id}`, {
          method: 'DELETE',
        }),
        j = await r.json()
      if (!r.ok) throw Error(j.error)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-3">
      <h3 className="font-semibold text-military-900">{title}</h3>
      {editable && allowUpload && (
        <label className="block rounded-lg border border-dashed border-military-300 p-4 text-sm">
          แนบ PDF ได้หลายไฟล์ · ไม่เกิน 8 MB ต่อไฟล์
          <input
            aria-label="อัปโหลด PDF คำสั่ง"
            className="mt-2 block w-full"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy || disabled}
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
      {busy && (
        <p className="text-sm" role="status">
          กำลังบันทึกไฟล์…
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}{' '}
          <button type="button" onClick={load}>
            ลองใหม่
          </button>
        </p>
      )}
      {!files.length && !error && (
        <p className="text-sm text-gray-500">ยังไม่มีไฟล์แนบ</p>
      )}
      {files.map((file) => (
        <div
          key={file._id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-military-50 p-3"
        >
          <div className="min-w-0">
            <p className="break-all text-sm font-medium">{file.fileName}</p>
            <p className="text-xs text-gray-500">
              {new Date(file.uploadedAt).toLocaleDateString('th-TH')} ·{' '}
              {Math.ceil(file.size / 1024)} KB
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <a
              className="text-blue-700 underline"
              target="_blank"
              rel="noreferrer"
              href={`/api/orders/${orderId}/documents/${file._id}`}
            >
              เปิดดู
            </a>
            <a
              className="text-blue-700 underline"
              href={`/api/orders/${orderId}/documents/${file._id}?download=1`}
            >
              ดาวน์โหลด
            </a>
            {editable && (
              <button
                type="button"
                disabled={busy || disabled}
                className="text-red-600"
                onClick={() => remove(file._id)}
              >
                ลบ
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  )
}
