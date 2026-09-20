'use client'

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

type Fields = Record<string, string | number | null | undefined>
type CalPointTable = { _id: string; tableName: string; points: { pointValue: string | number; unit: string }[]; stdValues: (string | number | null)[]; order: number }
type Version = { _id: string; year: number; revision: number; fields: Fields; calPoints: CalPointTable[]; pdf?: { fileName: string; certNo?: string; expiryDate?: string } }
type Legacy = { fields: Fields; calPoints: CalPointTable[]; certificates: { _id?: string; year: number; fileName: string; certNo?: string }[] }
type UpdateItem = { recordId: string; certNo: string; amedNo: string; unitName: string; calDate: string; approvalStatus: string; updatedAt: string; status: 'ready' | 'manual'; reason?: string; changes: string[] }
type History = { _id: string; recordId: string; certNo: string; createdAt: string }
type Preview = { versionId: string; items: UpdateItem[]; history: History[] }
type TableDraft = { _id: string; tableName: string; points: string; units: string; stdValues: string }
type Draft = { year: string; expectedRevision: number; fields: Fields; tables: TableDraft[]; source: string }
const FIELDS = [
  ['no', 'รหัส'], ['name', 'ชื่อเครื่องมือ'], ['manufacture', 'ผู้ผลิต'], ['model', 'รุ่น'],
  ['serialNo', 'Serial No.'], ['certNo', 'เลขที่ใบรับรอง'], ['measurement', 'การวัด'], ['unit', 'หน่วย'],
  ['calDate', 'วันที่สอบเทียบ'], ['correction', 'Correction'], ['uTStd', 'uTStd'], ['uTDrif', 'uTDrif'],
  ['uTResStd', 'uTResStd'], ['uTUuc', 'uTUuc'], ['uTInt', 'uTInt'], ['uT6', 'uT6'], ['uT7', 'uT7'], ['uT8', 'uT8'], ['uT9', 'uT9'], ['uT10', 'uT10'], ['expandedU', 'expandedU'],
]
const NUMBERS = new Set(['correction', 'uTStd', 'uTDrif', 'uTResStd', 'uTUuc', 'uTInt', 'uT6', 'uT7', 'uT8', 'uT9', 'uT10', 'expandedU'])
const beYear = (year: number) => year > 2400 ? year : year + 543
const ceYear = (year: number) => year > 2400 ? year - 543 : year
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ'
const buttonClass = 'rounded border border-military-300 bg-white px-3 py-1.5 text-sm text-military-800 disabled:opacity-40'
const primaryClass = 'rounded bg-military-800 px-3 py-1.5 text-sm text-white disabled:opacity-40'

function toTables(tables: CalPointTable[] = []): TableDraft[] {
  return [...tables].sort((a, b) => (a.order || 0) - (b.order || 0)).map(table => ({
    _id: table._id || crypto.randomUUID(), tableName: table.tableName || '',
    points: (table.points || []).map(point => point.pointValue).join(', '),
    units: (table.points || []).map(point => point.unit || '').join(', '),
    stdValues: (table.stdValues || []).map(value => value ?? '').join(', '),
  }))
}

// Empty cells retain their position; time values are intentionally kept as strings.
export function annualTablesFromDraft(tables: TableDraft[], fields: Fields): CalPointTable[] {
  const isTime = String(fields.measurement || '').toLowerCase() === 'time' || String(fields.unit || '').toLowerCase() === 'h:mm:ss'
  const value = (text: string, description: string) => {
    if (isTime) return text
    const number = Number(text)
    if (!Number.isFinite(number)) throw new Error(`${description}: ต้องเป็นตัวเลข`)
    return number
  }
  return tables.map((table, order) => {
    const points = table.points.trim() ? table.points.split(',').map(text => text.trim()) : []
    const standards = table.stdValues.trim() ? table.stdValues.split(',').map(text => text.trim()) : []
    const units = table.units.split(',').map(text => text.trim())
    if (!points.length) throw new Error(`ตาราง ${order + 1}: กรุณาระบุจุดสอบเทียบ หรือลบตารางว่าง`)
    if (points.some(point => !point)) throw new Error(`ตาราง ${order + 1}: จุดสอบเทียบมีช่องว่าง`)
    if (standards.length > points.length) throw new Error(`ตาราง ${order + 1}: ค่า STD มากกว่าจุดสอบเทียบ`)
    if (units.length > 1 && units.length !== points.length) throw new Error(`ตาราง ${order + 1}: ระบุหน่วยเดียว หรือหนึ่งหน่วยต่อจุดสอบเทียบ`)
    return {
      _id: table._id, tableName: table.tableName, order,
      points: points.map((point, index) => ({ pointValue: value(point, `ตาราง ${order + 1}`), unit: (units.length === 1 ? units[0] : units[index]) || String(fields.unit || '') })),
      stdValues: points.map((_, index) => standards[index] ? value(standards[index], `ค่า STD ตาราง ${order + 1}`) : null),
    }
  })
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `ดำเนินการไม่สำเร็จ (${response.status})`)
  return data
}

export default function StandardInstrumentYears({ instrument, onChanged }: { instrument: any; onChanged: () => void }) {
  const endpoint = `/api/admin/stdinstruments/${encodeURIComponent(instrument._id)}/years`
  const [versions, setVersions] = useState<Version[]>([])
  const [legacy, setLegacy] = useState<Legacy | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [draftPdf, setDraftPdf] = useState<File | null>(null)
  const [draftPdfExpiry, setDraftPdfExpiry] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const lock = useRef(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [attempted, setAttempted] = useState(false)
  const [pdfCertNo, setPdfCertNo] = useState('')
  const [pdfExpiry, setPdfExpiry] = useState('')
  const [reload, setReload] = useState(0)
  const selected = versions.find(version => version.year === selectedYear)
  const clearPreview = () => { setPreview(null); setResults({}); setAttempted(false) }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    request(endpoint, { signal: controller.signal }).then(data => {
      setVersions(data.data || [])
      setLegacy(data.legacy || null)
      setSelectedYear(previous => data.data?.some((v: Version) => v.year === previous) ? previous : null)
    }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, reload])

  useEffect(() => {
    setPdfCertNo(selected?.pdf?.certNo || String(selected?.fields.certNo || ''))
    setPdfExpiry(selected?.pdf?.expiryDate?.slice(0, 10) || '')
  }, [selected])

  async function run(label: string, action: () => Promise<void>) {
    if (lock.current) return
    lock.current = true
    setBusy(label)
    setError('')
    try { await action() } catch (error) { setError(errorMessage(error)) }
    finally { lock.current = false; setBusy('') }
  }

  function startDraft(mode: 'edit' | 'copy' | 'legacy') {
    clearPreview()
    setDraftPdf(null)
    setDraftPdfExpiry(mode === 'edit' ? selected?.pdf?.expiryDate?.slice(0, 10) || '' : '')
    const source = mode === 'legacy' ? legacy : mode === 'copy' ? versions[0] : selected
    const fields = { ...(source?.fields || {}) }
    if (mode === 'copy') {
      setSelectedYear(null)
      for (const key of ['calDate', ...Array.from(NUMBERS)]) fields[key] = ''
    }
    setDraft({
      year: mode === 'edit' && selected ? String(beYear(selected.year)) : '',
      expectedRevision: mode === 'edit' ? selected?.revision || 0 : 0,
      fields, tables: toTables(source?.calPoints),
      source: mode === 'legacy' ? 'เริ่มจากข้อมูลเดิมที่ยังไม่ได้ระบุปี กรุณาตรวจสอบข้อมูลทุกช่องและยืนยันปี พ.ศ. ก่อนบันทึก ข้อมูลนี้ไม่ใช่ประวัติของปีใน PDF เดิม' : mode === 'copy' ? `ใช้ข้อมูลเครื่องมือจากปี พ.ศ. ${beYear(versions[0].year)} กรุณาระบุปีใหม่ วันที่สอบเทียบ Correction ค่า uT และ expandedU (PDF ไม่ถูกคัดลอก)` : '',
    })
  }

  async function save() {
    if (!draft) return
    await run('กำลังบันทึกข้อมูลรายปี…', async () => {
      const year = ceYear(Number(draft.year))
      if (!Number.isInteger(year) || year < 1900 || year > 2300) throw new Error('กรุณาระบุปี พ.ศ. หรือ ค.ศ. ที่ถูกต้อง')
      if (!draft.expectedRevision && versions.some(version => version.year === year)) throw new Error('มีข้อมูลปีนี้แล้ว กรุณาเลือกปีและแก้ไขข้อมูล')
      const fields = Object.fromEntries(FIELDS.map(([key]) => {
        const input = draft.fields[key] ?? ''
        if (NUMBERS.has(key) && input !== '' && !Number.isFinite(Number(input))) throw new Error(`${key}: ต้องเป็นตัวเลข`)
        return [key, NUMBERS.has(key) && input !== '' ? Number(input) : input]
      }))
      const payload = { year, fields, calPoints: annualTablesFromDraft(draft.tables, fields), expectedRevision: draft.expectedRevision, pdfExpiryDate: draftPdfExpiry }
      let init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      if (draftPdf) {
        const form = new FormData()
        form.append('data', JSON.stringify(payload))
        form.append('file', draftPdf)
        init = { method: 'POST', body: form }
      }
      const data = await request(endpoint, init)
      setVersions(previous => [...previous.filter(version => version.year !== data.data.year), data.data].sort((a, b) => b.year - a.year))
      setSelectedYear(data.data.year)
      setDraft(null)
      clearPreview()
      toast.success('บันทึกข้อมูลรายปีแล้ว')
      onChanged()
    })
  }

  async function upload(file: File) {
    if (!selected) return
    await run('กำลังอัปโหลด PDF…', async () => {
      const form = new FormData()
      form.append('file', file)
      form.append('expectedRevision', String(selected.revision))
      form.append('certNo', pdfCertNo)
      form.append('expiryDate', pdfExpiry)
      clearPreview()
      await request(`${endpoint}/${selected.year}/pdf`, { method: 'POST', body: form })
      const data = await request(endpoint)
      setVersions(data.data || [])
      toast.success('บันทึก PDF แล้ว')
      onChanged()
    })
  }

  async function checkUpdates() {
    if (!selected) return
    clearPreview()
    await run('กำลังตรวจสอบใบรับรองที่ได้รับผลกระทบ…', async () => {
      setPreview(await request(`${endpoint}/${selected.year}/updates`))
    })
  }

  async function confirmUpdates() {
    if (!preview || !selected || attempted) return
    await run('กำลังอัปเดตใบรับรอง…', async () => {
      setAttempted(true)
      for (const item of preview.items.filter(item => item.status === 'ready')) {
        try {
          await request(`${endpoint}/${selected.year}/updates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: preview.versionId, recordId: item.recordId, expectedUpdatedAt: item.updatedAt }) })
          setResults(previous => ({ ...previous, [item.recordId]: { ok: true, message: 'อัปเดตสำเร็จ' } }))
        } catch (error) {
          setResults(previous => ({ ...previous, [item.recordId]: { ok: false, message: errorMessage(error) } }))
        }
      }
      const latest = await request(`${endpoint}/${selected.year}/updates`)
      setPreview(previous => previous ? { ...previous, history: latest.history || [] } : previous)
      onChanged()
    })
  }

  if (loading) return <p className="py-4 text-sm text-gray-500">กำลังโหลดข้อมูลรายปี…</p>
  const readyCount = preview?.items.filter(item => item.status === 'ready').length || 0
  const setTable = (index: number, patch: Partial<TableDraft>) => setDraft(previous => previous && ({ ...previous, tables: previous.tables.map((table, i) => i === index ? { ...table, ...patch } : table) }))
  const moveTable = (index: number, direction: number) => setDraft(previous => {
    if (!previous) return previous
    const tables = [...previous.tables]
    ;[tables[index], tables[index + direction]] = [tables[index + direction], tables[index]]
    return { ...previous, tables }
  })

  const yearContent = <>
      {!draft && <div className="flex flex-wrap items-center justify-between gap-2">
        {selected && <><span className="text-sm text-gray-500">รายละเอียดปี พ.ศ. {beYear(selected.year)} · ฉบับข้อมูล {selected.revision}</span><button type="button" className={buttonClass} onClick={() => startDraft('edit')}>แก้ไขปีนี้</button></>}
        {!versions.length && legacy && <button type="button" className={primaryClass} onClick={() => startDraft('legacy')}>เริ่มข้อมูลรายปีจากข้อมูลเดิม</button>}
      </div>}
      {!versions.length && !draft && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">ยังไม่ได้กำหนดปีให้ข้อมูลเดิม โปรดเลือกเริ่มข้อมูลรายปี ตรวจสอบค่าทั้งหมด และระบุปีด้วยตนเอง</p>}
      {draft ? <div className="space-y-4 rounded border border-military-200 bg-white p-4">
        {draft.source && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">{draft.source}</p>}
        <label className="block text-sm font-medium">ปี พ.ศ. (รับ ค.ศ. ได้เช่นกัน)<input aria-label="ปีของข้อมูลที่จะบันทึก" type="number" className="input-field mt-1 max-w-48" placeholder="เช่น 2569" value={draft.year} disabled={draft.expectedRevision > 0} onChange={event => setDraft({ ...draft, year: event.target.value })} /></label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{FIELDS.map(([key, label]) => <label key={key} className="block text-xs text-gray-600">{label}<input className="input-field mt-1 text-sm" type={key === 'calDate' ? 'date' : NUMBERS.has(key) ? 'number' : 'text'} step="any" value={key === 'calDate' ? String(draft.fields[key] || '').slice(0, 10) : draft.fields[key] ?? ''} onChange={event => setDraft({ ...draft, fields: { ...draft.fields, [key]: event.target.value } })} /></label>)}</div>
        <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">ตารางจุดสอบเทียบ ({draft.tables.length})</h4><button type="button" className={buttonClass} onClick={() => setDraft({ ...draft, tables: [...draft.tables, { _id: crypto.randomUUID(), tableName: '', points: '', units: String(draft.fields.unit || ''), stdValues: '' }] })}>+ เพิ่มตาราง</button></div>
        <p className="text-xs text-gray-500">คั่นแต่ละค่าด้วยจุลภาค (,) ช่องค่า STD ว่างจะคงตำแหน่งเดิม การวัด Time รองรับข้อความเวลา เช่น 01:30 สามารถบันทึกโดยไม่มีตารางได้</p>
        {draft.tables.map((table, index) => <div key={table._id} className="space-y-3 rounded border p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">ตาราง {index + 1}</span><button type="button" aria-label={`เลื่อนตาราง ${index + 1} ขึ้น`} disabled={index === 0} className={buttonClass} onClick={() => moveTable(index, -1)}>↑</button><button type="button" aria-label={`เลื่อนตาราง ${index + 1} ลง`} disabled={index === draft.tables.length - 1} className={buttonClass} onClick={() => moveTable(index, 1)}>↓</button><button type="button" className={buttonClass} onClick={() => setDraft({ ...draft, tables: draft.tables.filter((_, i) => i !== index) })}>ลบตาราง</button></div>
          <div className="grid gap-3 sm:grid-cols-2">{([['tableName', 'ชื่อตาราง'], ['points', 'จุดสอบเทียบ (คั่นด้วย ,)'], ['units', 'หน่วย (หนึ่งหน่วย หรือคั่นด้วย , ตามจำนวนจุด)'], ['stdValues', 'ค่า STD (คั่นด้วย ,)']] as const).map(([key, label]) => <label key={key} className="text-xs text-gray-600">{label}<input className="input-field mt-1" value={table[key]} onChange={event => setTable(index, { [key]: event.target.value })} /></label>)}</div>
        </div>)}
        <div className="space-y-3 rounded border p-3">
          <h4 className="text-sm font-semibold">PDF ของปีนี้ (ไม่บังคับ)</h4>
          {draft.expectedRevision > 0 && selected?.pdf && <p className="text-sm text-gray-600">ไฟล์ปัจจุบัน: {selected.pdf.fileName} · เลือกไฟล์ใหม่เพื่อแทนที่</p>}
          <label className="block text-sm">แนบ PDF<input aria-label="แนบ PDF พร้อมบันทึกข้อมูลรายปี" type="file" accept="application/pdf,.pdf" className="mt-1 block text-sm" onChange={event => setDraftPdf(event.target.files?.[0] || null)} /></label>
          <label className="block text-sm">วันหมดอายุ PDF<input type="date" className="input-field mt-1 max-w-64" value={draftPdfExpiry} onChange={event => setDraftPdfExpiry(event.target.value)} /></label>
          <p className="text-xs text-gray-500">ไฟล์ PDF ขนาดไม่เกิน 8 MB จะบันทึกพร้อมข้อมูลเมื่อกดยืนยัน</p>
        </div>
        <div className="flex gap-2"><button type="button" className={primaryClass} onClick={save}>ยืนยันปีและบันทึกข้อมูลทั้งหมด</button><button type="button" className={buttonClass} onClick={() => setDraft(null)}>ยกเลิก</button></div>
      </div> : selected && <>
        <dl className="grid grid-cols-2 gap-3 rounded border bg-white p-3 lg:grid-cols-4">{FIELDS.map(([key, label]) => <div key={key}><dt className="text-xs text-gray-500">{label}</dt><dd className="break-words text-sm">{selected.fields[key] === '' || selected.fields[key] == null ? '—' : String(selected.fields[key])}</dd></div>)}</dl>
        <div className="space-y-3"><h4 className="text-sm font-semibold">ตารางจุดสอบเทียบ ({selected.calPoints.length})</h4>{!selected.calPoints.length && <p className="text-sm text-gray-500">ปีนี้ไม่มีตารางจุดสอบเทียบ</p>}{[...selected.calPoints].sort((a, b) => a.order - b.order).map((table, index) => <div key={table._id} className="overflow-x-auto rounded border bg-white"><table className="w-full text-left text-sm"><caption className="bg-military-50 p-2 text-left font-medium">{table.tableName || `ตาราง ${index + 1}`}</caption><thead><tr><th className="p-2">จุดสอบเทียบ</th><th className="p-2">หน่วย</th><th className="p-2">ค่า STD</th></tr></thead><tbody>{table.points.map((point, index) => <tr key={index} className="border-t"><td className="p-2">{point.pointValue}</td><td className="p-2">{point.unit}</td><td className="p-2">{table.stdValues[index] ?? '—'}</td></tr>)}</tbody></table></div>)}</div>
        <div className="space-y-3 rounded border bg-white p-3"><h4 className="text-sm font-semibold">PDF ของปี พ.ศ. {beYear(selected.year)} (ไม่บังคับ)</h4>{selected.pdf ? <a className="text-sm text-blue-700 underline" href={`${endpoint}/${selected.year}/pdf`} target="_blank" rel="noreferrer">{selected.pdf.fileName}</a> : <p className="text-sm text-gray-500">ยังไม่มี PDF สำหรับปีนี้</p>}
          <div className="flex flex-wrap items-end gap-3"><label className="text-xs">เลขที่ใบรับรอง PDF<input className="input-field mt-1" value={pdfCertNo} onChange={event => setPdfCertNo(event.target.value)} /></label><label className="text-xs">วันหมดอายุ<input type="date" className="input-field mt-1" value={pdfExpiry} onChange={event => setPdfExpiry(event.target.value)} /></label><label className="text-xs">{selected.pdf ? 'แทนที่ PDF' : 'อัปโหลด PDF'}<input aria-label="อัปโหลด PDF ของปีที่เลือก" type="file" accept="application/pdf,.pdf" className="mt-1 block text-sm" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} /></label></div>
        </div>
        <div className="space-y-3 rounded border border-military-300 bg-white p-3"><h4 className="text-sm font-semibold">อัปเดตใบรับรองที่ใช้มาตรฐานปีนี้</h4><p className="text-xs text-gray-600">ตรวจสอบรายการและค่าที่เปลี่ยนก่อนยืนยัน ระบบจะคงเลขใบรับรองและสถานะอนุมัติ พร้อมเก็บฉบับเดิมไว้ในประวัติ</p><button type="button" className={buttonClass} onClick={checkUpdates}>{attempted ? 'ตรวจสอบอีกครั้ง / ลองรายการที่ไม่สำเร็จ' : 'Check update — ตรวจสอบผลกระทบ'}</button>
          {preview && <><p className="text-sm">พบ {preview.items.length} รายการ · พร้อมอัปเดต {readyCount} · ต้องตรวจสอบเอง {preview.items.length - readyCount}</p>{preview.items.length === 0 && <p className="text-sm text-gray-500">ไม่มีใบรับรองที่ต้องอัปเดต</p>}
            <div className="space-y-2">{preview.items.map(item => <div key={item.recordId} className="rounded border p-3 text-sm"><p className="font-medium"><a className="text-blue-700 underline" href={`/records/${encodeURIComponent(item.recordId)}`} target="_blank" rel="noreferrer">เปิดรายการสอบเทียบ</a> · {item.certNo || 'ยังไม่มีเลขใบรับรอง'} · {item.amedNo} · {item.unitName}</p><p className="text-xs text-gray-500">{item.calDate} · สถานะอนุมัติ: {item.approvalStatus}</p><ul className="my-2 list-disc pl-5">{item.changes.map((change, index) => <li key={index}>{change}</li>)}</ul>{item.status === 'manual' && <p className="text-amber-800">ต้องตรวจสอบเอง: {item.reason || 'ไม่สามารถอัปเดตอัตโนมัติได้'}</p>}{results[item.recordId] && <p role="status" className={results[item.recordId].ok ? 'text-green-700' : 'text-red-700'}>{results[item.recordId].message}</p>}</div>)}</div>
            {readyCount > 0 && <button type="button" disabled={attempted} className={primaryClass} onClick={confirmUpdates}>ยืนยันอัปเดตใบรับรองทั้งหมด {readyCount} รายการ</button>}
            {!!preview.history?.length && <div className="space-y-2 border-t pt-3"><h5 className="text-sm font-semibold">ประวัติใบรับรองฉบับเดิม</h5>{preview.history.map(entry => <a key={entry._id} className="block text-sm text-blue-700 underline" href={`/api/certificates/${encodeURIComponent(entry.recordId)}?revisionId=${encodeURIComponent(entry._id)}`} target="_blank" rel="noreferrer">{entry.certNo || entry.recordId} · {new Date(entry.createdAt).toLocaleString('th-TH')}</a>)}</div>}
          </>}
        </div>
      </>}
  </>

  return <div className="space-y-4">
    <p className="text-sm text-gray-600">ข้อมูลเครื่องมือและตารางสอบเทียบแยกตามปี งานสอบเทียบใหม่ใช้ข้อมูลปีล่าสุด การบันทึกข้อมูลจะยังไม่เปลี่ยนใบรับรองเดิม</p>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" disabled={!!busy} className="underline" onClick={() => { clearPreview(); setDraft(null); setReload(value => value + 1) }}>โหลดข้อมูลล่าสุด</button></div>}
    {busy && <p role="status" className="text-sm text-military-700">{busy}</p>}
    <fieldset disabled={!!busy} className="space-y-4 min-w-0">
      {!!versions.length && <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">ข้อมูลรายปี</h4>
        <button type="button" disabled={!!draft} className={primaryClass} onClick={() => startDraft('copy')}>+ เพิ่มปี</button>
      </div>}
      {!!versions.length && draft?.expectedRevision === 0 && yearContent}
      {versions.map((version, index) => <div key={version.year} className="overflow-hidden rounded border border-gray-200">
        <button type="button" aria-expanded={selectedYear === version.year} aria-controls={`standard-year-${instrument._id}-${version.year}`} disabled={!!draft}
          className={`flex w-full items-center justify-between px-4 py-3 text-left font-medium ${index === 0 ? 'bg-green-100 text-green-900' : 'bg-gray-50 text-gray-700'}`}
          onClick={() => { setSelectedYear(previous => previous === version.year ? null : version.year); clearPreview() }}>
          <span>พ.ศ. {beYear(version.year)}{index === 0 && <span className="ml-2 text-sm">ใช้งานปัจจุบัน</span>}</span>
          <span aria-hidden="true">{selectedYear === version.year ? '▲' : '▼'}</span>
        </button>
        {selectedYear === version.year && <div id={`standard-year-${instrument._id}-${version.year}`} className="space-y-4 border-t p-4">{yearContent}</div>}
      </div>)}
      {!versions.length && yearContent}
    </fieldset>
    {(selectedYear !== null || !versions.length) && !!legacy?.certificates?.length && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm"><h4 className="font-semibold">PDF เดิมที่เก็บไว้ก่อนมีข้อมูลรายปี</h4><p className="mt-1 text-amber-900">รายการเหล่านี้มีเพียงไฟล์ PDF ไม่ยืนยันว่ามีค่ามาตรฐานและตารางสอบเทียบของปีนั้น ต้องตรวจสอบต้นฉบับและเพิ่มข้อมูลปีด้วยตนเอง</p><ul className="mt-2 space-y-1">{legacy.certificates.map((certificate, index) => <li key={certificate._id || index}>พ.ศ. {beYear(certificate.year)} · {certificate.fileName} {certificate.certNo && `· ${certificate.certNo}`}</li>)}</ul></div>}
  </div>
}
