'use client'
import { useEffect, useRef, useState } from 'react'
import { DOCUMENT_GROUPS, collectRecordDocuments, downloadDocumentFiles, type DownloadDocument, type DownloadRecord } from '@/lib/recordDownload'

export default function RecordDownloadAll({ records, disabled }: { records: DownloadRecord[]; disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [documents, setDocuments] = useState<DownloadDocument[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [snapshot, setSnapshot] = useState<DownloadRecord[]>([])
  const busyRef = useRef(false)
  useEffect(() => () => { controller.current?.abort() }, [])

  async function load(rows: DownloadRecord[]) {
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setComplete(false); setLoading(true); setError(''); setDocuments([]); setSelected(new Set()); setProgress('')
    try {
      const docs = await collectRecordDocuments(rows, async url => {
        const response = await fetch(url, { signal: abort.signal, cache: 'no-store' })
        if (!response.ok) throw Error('โหลดรายการเอกสารไม่สำเร็จ')
        return response.json()
      })
      if (abort.signal.aborted) return
      setDocuments(docs); setSelected(new Set(docs.filter(doc => doc.url).map(doc => doc.id)))
    } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'โหลดเอกสารไม่สำเร็จ') }
    finally { if (!abort.signal.aborted) setLoading(false) }
  }
  function open() {
    const rows = records.map(record => ({...record}))
    setSnapshot(rows); dialog.current?.showModal(); void load(rows)
  }
  function close() { if (busyRef.current) return; controller.current?.abort(); dialog.current?.close() }
  async function download() {
    if (busyRef.current || complete || !selected.size) return
    busyRef.current = true; setBusy(true); setError(''); setProgress('กำลังเตรียมไฟล์…')
    const abort = new AbortController(); controller.current = abort
    try {
      const files = await downloadDocumentFiles(documents.filter(doc => selected.has(doc.id)), async url => {
        const response = await fetch(url, { signal: abort.signal, cache: 'no-store' })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          const doc = documents.find(item => item.url === url)
          throw Error(`${body.error || 'ดาวน์โหลดไม่สำเร็จ'} — ${doc?.recordLabel || ''} · ${doc?.label || ''}`)
        }
        return new Uint8Array(await response.arrayBuffer())
      }, (done, total) => setProgress(`เตรียมไฟล์ ${done}/${total}`))
      setProgress('กำลังสร้าง ZIP…')
      const {zip} = await import('fflate')
      const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, {level: 0}, (error, result) => error ? reject(error) : resolve(result)))
      if (abort.signal.aborted) return
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], {type: 'application/zip'}))
      const link = document.createElement('a'); link.href = url
      link.download = `calibration-documents-${new Date().toISOString().slice(0,10)}.zip`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      setComplete(true)
      setProgress(`สร้าง ZIP แล้ว ${selected.size} เอกสาร`)
    } catch (error) { if (!abort.signal.aborted) { setError(error instanceof Error ? error.message : 'ดาวน์โหลดไม่สำเร็จ'); setProgress('ยังไม่ได้สร้าง ZIP กรุณาลองใหม่ หรือเอาเครื่องหมายถูกออกจากไฟล์ที่มีปัญหา') } }
    finally { busyRef.current = false; setBusy(false) }
  }
  const available = documents.filter(doc => doc.url)
  return <>
    <button type="button" disabled={disabled || !records.length} onClick={open} className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-40">Download all</button>
    <dialog ref={dialog} onCancel={event => { event.preventDefault(); close() }} aria-labelledby="download-all-title"
      className="w-[min(56rem,calc(100%-2rem))] max-h-[85vh] rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/40">
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div><h2 id="download-all-title" className="text-lg font-semibold text-military-900">ดาวน์โหลดเอกสารทั้งหมด</h2><p className="mt-1 text-sm text-gray-500">จาก {snapshot.length} รายการที่แสดงในหน้าปัจจุบัน · เลือกเอกสารที่ต้องการดาวน์โหลดเป็น ZIP</p></div>
          <button type="button" onClick={close} disabled={busy} aria-label="ปิดหน้าต่าง" className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-40">✕</button>
        </div>
        <div className="overflow-y-auto p-5">
          {loading && <p role="status" className="text-sm text-gray-500">กำลังรวบรวมรายการเอกสาร…</p>}
          {error && <div role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}{!documents.length && !loading && <button type="button" className="ml-2 underline" onClick={() => load(snapshot)}>ลองใหม่</button>}</div>}
          {!loading && documents.some(doc => doc.loadError) && <div role="alert" className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-800">
            เอกสารบางส่วนโหลดไม่สำเร็จ ยังเลือกดาวน์โหลดเอกสารที่โหลดได้ หรือโหลดรายการใหม่ได้
            <button type="button" disabled={busy} className="ml-2 underline disabled:opacity-40" onClick={() => load(snapshot)}>โหลดรายการใหม่</button>
          </div>}
          {!loading && !!documents.length && <>
            <label className="mb-4 flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={busy} checked={available.length > 0 && selected.size === available.length} ref={node => { if (node) node.indeterminate = selected.size > 0 && selected.size < available.length }} onChange={event => { setComplete(false); setProgress(''); setSelected(new Set(event.target.checked ? available.map(doc => doc.id) : [])) }} />เลือกทั้งหมด ({selected.size}/{available.length} เอกสาร)</label>
            <div className="space-y-4">{DOCUMENT_GROUPS.map(group => {
              const docs = documents.filter(doc => doc.group === group.key)
              return <section key={group.key} className="overflow-hidden rounded border border-gray-200"><h3 className="bg-gray-50 px-3 py-2 text-sm font-medium">{group.label} ({docs.filter(doc => doc.url).length})</h3>
                {!docs.length && <p className="px-3 py-2 text-xs text-gray-400">ไม่มีเอกสารเพิ่มเติม (ไฟล์ที่ซ้ำแสดงในกลุ่มก่อนหน้าแล้ว)</p>}
                <ul className="divide-y divide-gray-100">{docs.map(doc => <li key={doc.id}><label className={`flex items-center gap-3 px-3 py-2 text-sm ${doc.url ? 'cursor-pointer' : 'text-gray-400'}`}>
                  <input type="checkbox" disabled={busy || !doc.url} checked={selected.has(doc.id)} onChange={event => { setComplete(false); setProgress(''); setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(doc.id); else next.delete(doc.id); return next }) }} />
                  <span className="min-w-0 break-words">{doc.label}{doc.usedAs && doc.usedAs.length > 1 && <span className="ml-2 text-xs text-gray-500">ใช้ร่วม: {doc.usedAs.join(' / ')}</span>}{doc.usedBy && doc.usedBy.length > 1 && <span title={doc.usedBy.join('\n')} className="ml-2 text-xs text-gray-500">ใช้ใน {doc.usedBy.length} รายการ</span>}{doc.unavailable && <span className="ml-2 text-xs">({doc.unavailable})</span>}</span>
                </label></li>)}</ul>
              </section>
            })}</div>
          </>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t p-5">
          <p role="status" className="text-sm text-gray-500">{progress}</p>
          <div className="flex gap-2"><button type="button" disabled={busy} onClick={close} className="btn-secondary disabled:opacity-40">ปิด</button><span className="contents">{complete ? <span role="status" className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 font-medium text-green-700"><span aria-hidden="true">✓</span> สำเร็จ</span> : <button type="button" disabled={loading || busy || !selected.size} onClick={download} className="btn-primary disabled:opacity-40">{busy ? 'กำลังดาวน์โหลด…' : `ดาวน์โหลด ZIP (${selected.size})`}</button>}</span></div>
        </div>
      </div>
    </dialog>
  </>
}
