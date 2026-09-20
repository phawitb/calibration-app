'use client'
import { useEffect, useState } from 'react'

type Item = { slot: string; no?: string; name?: string; certNo?: string; year?: number; hasPdf: boolean }
export default function RecordStandardCertificates({ recordId }: { recordId: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`/api/records/${recordId}/standard-certificates`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('โหลดใบเซอร์เครื่องมือมาตรฐานไม่สำเร็จ'); return response.json() })
      .then(result => setItems(result.data || []))
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [recordId, open])
  return <>
    <button type="button" aria-expanded={open} aria-controls={`standard-certificates-${recordId}`} onClick={() => setOpen(value => !value)}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded border border-military-300 px-2 py-1 text-xs font-medium text-military-700 hover:bg-military-50">
      ใบเซอร์เครื่องมือมาตรฐาน
      <svg aria-hidden="true" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    {open && <div id={`standard-certificates-${recordId}`} className="mt-2 w-full basis-full overflow-hidden rounded border border-gray-200 bg-white">
      {loading ? <p className="px-3 py-2 text-xs text-gray-500">กำลังโหลด…</p> : error ? <p role="alert" className="px-3 py-2 text-xs text-red-600">{error}</p> : !items.length ? <p className="px-3 py-2 text-xs text-gray-500">รายการนี้ไม่มีข้อมูลเครื่องมือมาตรฐาน</p> :
        <ul className="divide-y divide-gray-100">{items.map(item => <li key={item.slot} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-medium text-military-700">{item.slot === 'std1' ? 'STD' : item.slot.toUpperCase()}</span>
            <span className="text-gray-800">{item.no} · {item.name}</span>
            <span className="text-gray-500">เซอร์ {item.certNo || '—'}{item.year ? ` · พ.ศ. ${item.year < 2400 ? item.year + 543 : item.year}` : ''}</span>
          </div>
          {item.hasPdf ? <a href={`/api/records/${recordId}/standard-certificates?slot=${item.slot}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded border border-military-300 px-2 py-1 font-medium text-military-700 hover:bg-military-50">เปิด PDF</a> : <span className="shrink-0 text-gray-400">ไม่มี PDF ที่ตรงกัน</span>}
        </li>)}</ul>}
    </div>}
  </>
}
