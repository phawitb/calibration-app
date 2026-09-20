'use client'

import { useCallback, useEffect, useState, useMemo, Fragment } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import AdminWorkOrders from './AdminWorkOrders'
import StandardInstrumentYears from './StandardInstrumentYears'
import { AMED_UC_KEYS, normalizeUcOptions } from '@/lib/amedUcOptions'

type RefType = string

const SUBTABS: {
  key: string
  label: string
  type: RefType
  desc: string
  fields: { key: string; label?: string; input?: 'number' }[]
}[] = [
  {
    key: 'units',
    label: 'หน่วยงาน',
    type: 'units',
    desc: 'ชื่อหน่วย / ที่อยู่ สำหรับ autofill ในแบบฟอร์ม',
    fields: [
      { key: 'no', label: 'รหัส/ลำดับ' },
      { key: 'unitId', label: 'Unit ID' },
      { key: 'name', label: 'ชื่อ (อังกฤษ)' },
      { key: 'thaiName', label: 'ชื่อ (ไทย)' },
      { key: 'address', label: 'ที่อยู่' },
    ],
  },
  {
    key: 'sections',
    label: 'แผนก / ห้อง',
    type: 'sections',
    desc: 'รายชื่อแผนก สำหรับ Suggest ในแบบฟอร์ม',
    fields: [
      { key: 'no', label: 'ลำดับ', input: 'number' as const },
      { key: 'name', label: 'ชื่อ (EN)' },
      { key: 'thaiName', label: 'ชื่อ (TH)' },
    ],
  },
  {
    key: 'devices',
    label: 'ชื่อเครื่องมือ',
    type: 'devices',
    desc: 'ชื่อเครื่องมือมาตรฐาน (ลูกค้า)',
    fields: [
      { key: 'no', label: 'ลำดับ', input: 'number' as const },
      { key: 'name', label: 'ชื่อ (EN)' },
      { key: 'thaiName', label: 'ชื่อ (TH)' },
      { key: 'calPrice', label: 'ราคาสอบเทียบ (บาท)', input: 'number' as const },
      { key: 'mainPrice', label: 'ราคาปบ. (บาท)', input: 'number' as const },
    ],
  },
  {
    key: 'brands',
    label: 'ยี่ห้อ / แบรนด์',
    type: 'brands',
    desc: 'รายชื่อยี่ห้อ (BrandName) — ใช้ reference อิสระ',
    fields: [
      { key: 'name', label: 'ชื่อยี่ห้อ' },
      { key: 'model', label: 'รุ่น' },
    ],
  },
  {
    key: 'stdinstruments',
    label: 'เครื่องมือมาตรฐาน (ฉบับเต็ม)',
    type: 'stdinstruments',
    desc: 'รายการ STD ฉบับเต็ม — รวม correction / uT',
    fields: [
      { key: 'no' },
      { key: 'name' },
      { key: 'manufacture' },
      { key: 'model' },
      { key: 'serialNo' },
      { key: 'certNo', label: 'Cert. / เลขที่ใบรับรอง' },
      { key: 'measurement' },
      { key: 'unit' },
      { key: 'calDate' },
      { key: 'correction', input: 'number' as const },
      { key: 'uTStd', input: 'number' as const },
      { key: 'uTDrif', input: 'number' as const },
      { key: 'uTResStd', input: 'number' as const },
      { key: 'uTUuc', input: 'number' as const },
      { key: 'uTInt', input: 'number' as const },
      { key: 'uT6', input: 'number' as const },
      { key: 'uT7', input: 'number' as const },
      { key: 'uT8', input: 'number' as const },
      { key: 'uT9', input: 'number' as const },
      { key: 'uT10', input: 'number' as const },
      { key: 'expandedU', input: 'number' as const },
    ].map((f) => ({ key: f.key, label: f.label || f.key, input: f.input })),
  },
  {
    key: 'certs',
    label: 'เลขที่ใบรับรอง (มุมมองย่อ)',
    type: 'stdinstruments',
    desc: 'ข้อมูลชุดเดียวกับเครื่องมาตรฐาน แสดงเฉพาะ Cert / รหัส ชื่อ วันที่',
    fields: [
      { key: 'no' },
      { key: 'name' },
      { key: 'model' },
      { key: 'serialNo' },
      { key: 'certNo', label: 'เลขที่ใบรับรอง' },
      { key: 'calDate' },
    ].map((f) => ({ key: f.key, label: f.label || f.key })),
  },
  {
    key: 'ameddevices',
    label: 'ทะเบียน AmedNo',
    type: 'ameddevices',
    desc: 'ทะเบียนเครื่องมือแพทย์ตาม รพ./หน่วยงาน',
    fields: [
      { key: 'amedNo', label: 'AmedNo' },
      { key: 'unitName', label: 'หน่วยงาน (รพ.)' },
      { key: 'section', label: 'แผนก' },
      { key: 'deviceName', label: 'ชื่อเครื่อง (EN)' },
      { key: 'brand', label: 'ยี่ห้อ' },
      { key: 'model', label: 'รุ่น' },
      { key: 'serialNo', label: 'Serial No.' },
      { key: 'hpNumber', label: 'HP Number' },
      { key: 'toSelect', label: 'ToSelect' },
      { key: 'uc1', label: 'UC1' },
      { key: 'uc2', label: 'UC2' },
      { key: 'uc3', label: 'UC3' },
      { key: 'uc4', label: 'UC4' },
      { key: 'uc5', label: 'UC5' },
      { key: 'uc6', label: 'UC6' },
      { key: 'ucT', label: 'UcT' },
    ],
  },
  { key: 'orders', label: 'คำสั่ง', type: 'orders', desc: '', fields: [] },
]

// Key columns shown in stdinstruments table (compact view)
const STD_TABLE_COLUMNS = [
  { key: 'no', label: 'รหัส' },
  { key: 'name', label: 'ชื่อเครื่อง' },
  { key: 'measurement', label: 'การวัด' },
  { key: 'unit', label: 'หน่วย' },
]

function fieldLabel(f: { key: string; label?: string }) {
  return f.label || f.key
}

/** Parse a CSV line respecting quoted fields with commas and escaped quotes */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

export default function ReferenceDataManager({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter()
  const [sub, setSub] = useState(SUBTABS.find(t => t.key === initialCategory) || SUBTABS[0])
  useEffect(() => { setSub(SUBTABS.find(t => t.key === initialCategory) || SUBTABS[0]) }, [initialCategory])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Record<string, any>>({})
  const [editId, setEditId] = useState<string | null>(null)

  // Expandable detail for stdinstruments
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Search and sort
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Reference options for ameddevices dropdowns
  const [refDevices, setRefDevices] = useState<string[]>([])
  const [refUnits, setRefUnits] = useState<string[]>([])
  const [refSections, setRefSections] = useState<string[]>([])
  const [refBrands, setRefBrands] = useState<{ name: string; model: string }[]>([])
  const [refStdNos, setRefStdNos] = useState<{ no: string; name: string }[]>([])
  const [importing, setImporting] = useState(false)

  // ---- Export CSV ----
  const exportCsv = () => {
    if (!rows.length) { toast.error('ไม่มีข้อมูลให้ export'); return }
    const fields = sub.fields
    const headers = ['_id', ...fields.map(f => f.key)]
    const csvRows = rows.map(r =>
      headers.map(h => {
        const value = sub.key === 'ameddevices' && AMED_UC_KEYS.some(key => key === h)
          ? JSON.stringify(normalizeUcOptions(r[h]))
          : String(r[h] ?? '')
        return `"${value.replace(/"/g, '""')}"`
      }).join(',')
    )
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sub.key}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---- Import CSV ----
  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset input
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = String(ev.target?.result || '')
      // Remove BOM
      const clean = text.replace(/^\uFEFF/, '')
      const lines = clean.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) {
        toast.error('CSV ต้องมีอย่างน้อย 1 header + 1 data row')
        return
      }

      // Parse header
      const headerLine = lines[0]
      const csvHeaders = parseCSVLine(headerLine)

      // Validate columns strictly
      const expectedFields = sub.fields.map(f => f.key)
      const allowedHeaders = ['_id', ...expectedFields]
      const unknownCols = csvHeaders.filter(h => !allowedHeaders.includes(h))
      if (unknownCols.length > 0) {
        toast.error(`Column ไม่ถูกต้อง: ${unknownCols.join(', ')}\n\nColumn ที่อนุญาต: ${allowedHeaders.join(', ')}`)
        return
      }
      // All field keys must be present (except _id which is optional)
      const missingCols = expectedFields.filter(f => !csvHeaders.includes(f))
      if (missingCols.length > 0) {
        toast.error(`ขาด column ที่จำเป็น: ${missingCols.join(', ')}`)
        return
      }

      // Parse data rows
      const dataRows: Record<string, any>[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        if (values.length !== csvHeaders.length) {
          toast.error(`แถวที่ ${i + 1}: จำนวน column ไม่ตรง (ได้ ${values.length}, ต้องการ ${csvHeaders.length})`)
          return
        }
        const row: Record<string, any> = {}
        csvHeaders.forEach((h, idx) => {
          const val = values[idx]
          // Convert number fields
          const fieldDef = sub.fields.find(f => f.key === h)
          if (fieldDef?.input === 'number' && val !== '') {
            const num = Number(val)
            row[h] = isNaN(num) ? val : num
          } else {
            row[h] = val
          }
        })
        dataRows.push(row)
      }

      if (!confirm(`ยืนยันนำเข้า ${dataRows.length} รายการ เข้า "${sub.label}"?\n\n• แถวที่มี _id ตรงกัน → อัพเดทข้อมูล\n• แถวใหม่ → เพิ่มเข้าระบบ\n• ข้อมูลเดิมที่ไม่อยู่ใน CSV จะไม่ถูกลบ`)) return

      setImporting(true)
      try {
        const res = await fetch('/api/admin/reference/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: sub.type, rows: dataRows, expectedColumns: csvHeaders }),
        })
        const j = await res.json()
        if (!res.ok) { toast.error(j.error || 'Import ไม่สำเร็จ'); return }
        toast.success(`Import สำเร็จ: เพิ่ม ${j.created} / อัพเดท ${j.updated} รายการ`)
        load()
      } catch {
        toast.error('เกิดข้อผิดพลาดในการ import')
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const load = useCallback(async () => {
    if (sub.type === 'orders') return
    setLoading(true)
    try {
      const res = await fetch(`/api/reference?type=${sub.type}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('โหลดไม่สำเร็จ')
      const j = await res.json()
      const data = Array.isArray(j.data) ? j.data : []
      setRows(data)
    } catch {
      toast.error('โหลดข้อมูลอ้างอิงไม่สำเร็จ')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [sub.type])

  useEffect(() => {
    load()
  }, [load])

  // Load reference options for ameddevices dropdowns
  useEffect(() => {
    if (sub.key !== 'ameddevices') return
    let mounted = true
    const loadRefs = async () => {
      const [devRes, unitRes, secRes, brandRes, stdRes] = await Promise.all([
        fetch('/api/reference?type=devices'),
        fetch('/api/reference?type=units'),
        fetch('/api/reference?type=sections'),
        fetch('/api/reference?type=brands'),
        fetch('/api/reference?type=stdinstruments'),
      ])
      if (!mounted) return
      if (devRes.ok) {
        const j = await devRes.json()
        setRefDevices((j.data || []).map((d: any) => d.name).filter(Boolean).sort())
      }
      if (unitRes.ok) {
        const j = await unitRes.json()
        setRefUnits((j.data || []).map((d: any) => d.name).filter(Boolean).sort())
      }
      if (secRes.ok) {
        const j = await secRes.json()
        setRefSections((j.data || []).map((d: any) => d.name).filter(Boolean).sort())
      }
      if (brandRes.ok) {
        const j = await brandRes.json()
        setRefBrands((j.data || []).filter((d: any) => d.name))
      }
      if (stdRes.ok) {
        const j = await stdRes.json()
        setRefStdNos(
          (j.data || [])
            .map((d: any) => ({ no: String(d.no || ''), name: String(d.name || '') }))
            .filter((d: any) => d.no)
            .sort((a: { no: string }, b: { no: string }) =>
              a.no.localeCompare(b.no, undefined, { numeric: true })
            )
        )
      }
    }
    loadRefs()
    return () => { mounted = false }
  }, [sub.key])

  const openAdd = () => {
    setEditId(null)
    const o: Record<string, any> = {}
    for (const f of sub.fields) o[f.key] = f.key === 'toSelect' ? false : sub.key === 'ameddevices' && AMED_UC_KEYS.some(key => key === f.key) ? [] : ''
    setEditing(o)
    setModal('add')
  }

  const openEdit = (r: any) => {
    setEditId(r._id)
    const o: Record<string, any> = {}
    for (const f of sub.fields) {
      const v = r[f.key]
      o[f.key] = v != null && v !== '' ? v : ''
    }
    setEditing(o)
    setModal('edit')
  }

  const save = async () => {
    const payload: Record<string, any> = { type: sub.type }
    for (const f of sub.fields) {
      const v = editing[f.key]
      if (f.input === 'number') {
        if (v === '' || v == null) continue
        const n = Number(v)
        if (!Number.isNaN(n)) payload[f.key] = n
        else payload[f.key] = v
      } else {
        if (v !== undefined) payload[f.key] = v
      }
    }
    try {
      if (modal === 'add') {
        const res = await fetch('/api/admin/reference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: sub.type, ...payload }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'บันทึกไม่สำเร็จ')
        }
        toast.success('เพิ่มรายการแล้ว')
      } else if (editId) {
        const res = await fetch('/api/admin/reference', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: sub.type, _id: editId, ...payload }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'อัปเดตไม่สำเร็จ')
        }
        toast.success('อัปเดตแล้ว')
      }
      setModal(null)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    }
  }

  const del = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    try {
      const res = await fetch(`/api/admin/reference?type=${encodeURIComponent(sub.type)}&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'ลบไม่สำเร็จ')
      }
      toast.success('ลบแล้ว')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Error')
    }
  }

  const toggleExpand = (id: string) => setExpandedId(current => current === id ? null : id)

  const isStdInstrumentsTab = sub.type === 'stdinstruments'
  const isAmedDevicesTab = sub.key === 'ameddevices'
  const serialIndex = sub.fields.findIndex(f => f.key === 'serialNo')
  const tableFields = isAmedDevicesTab ? sub.fields.slice(0, serialIndex + 1) : sub.fields
  const detailFields = isAmedDevicesTab ? sub.fields.slice(serialIndex + 1) : []

  // Determine columns for sorting: STD_TABLE_COLUMNS for stdinstruments, sub.fields for others
  const sortColumns = isStdInstrumentsTab ? STD_TABLE_COLUMNS : tableFields
  const defaultSortKey = sortColumns[0]?.key || ''

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const displayRows = useMemo(() => {
    let filtered = rows
    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      filtered = rows.filter(r =>
        Object.values(r).some(v =>
          v != null && String(v).toLowerCase().includes(q)
        )
      )
    }
    // Sort
    const sk = sortKey || defaultSortKey
    if (sk) {
      filtered = [...filtered].sort((a, b) => {
        const av = a[sk] ?? ''
        const bv = b[sk] ?? ''
        // Try numeric comparison
        const an = Number(av)
        const bn = Number(bv)
        if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') {
          return sortDir === 'asc' ? an - bn : bn - an
        }
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return filtered
  }, [rows, search, sortKey, sortDir, defaultSortKey])

  const refreshStandardRows = async () => {
    try {
      const response = await fetch('/api/reference?type=stdinstruments', { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      setRows(Array.isArray(data.data) ? data.data : [])
    } catch { /* The annual editor retains the saved version if list refresh fails. */ }
  }
  const renderStdDetail = (r: any) => <StandardInstrumentYears key={r._id} instrument={r} onChanged={refreshStandardRows} />

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-1 border-b border-military-200 pb-1"
        role="tablist"
        aria-label="หมวดข้อมูลอ้างอิง"
      >
        {SUBTABS.map((t) => (
          <button
            key={t.key + t.type}
            type="button"
            role="tab"
            aria-selected={sub.key === t.key}
            onClick={() => { router.replace(`/admin?tab=data&category=${t.key}`, { scroll: false }); setSub(t); setExpandedId(null); setSearch(''); setSortKey(''); setSortDir('asc') }}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-t-lg ${
              sub.key === t.key
                ? 'bg-military-800 text-white'
                : 'bg-white text-military-700 border border-b-0 border-military-200 hover:bg-military-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub.key === 'orders' ? <AdminWorkOrders /> : <>
      <p className="text-xs text-gray-500">{sub.desc}</p>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            className="input-field text-sm pl-8"
            placeholder="ค้นหา..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">&#128269;</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary text-xs whitespace-nowrap flex items-center gap-1" title="Export CSV">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Export
          </button>
          {!isStdInstrumentsTab && <label className={`btn-secondary text-xs whitespace-nowrap flex items-center gap-1 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`} title="Import CSV">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            {importing ? 'กำลัง Import...' : 'Import'}
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} disabled={importing} />
          </label>}
          <button type="button" onClick={openAdd} className="btn-primary text-sm whitespace-nowrap">
            + เพิ่มรายการ
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500 text-sm">กำลังโหลด…</p>
        ) : isStdInstrumentsTab ? (
          /* ===== Std Instruments: compact table + expand ===== */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-military-800 text-white text-left">
                  {STD_TABLE_COLUMNS.map((f) => {
                    const active = (sortKey || defaultSortKey) === f.key
                    return (
                    <th key={f.key} className="px-3 py-2 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-military-700 transition-colors" onClick={() => handleSort(f.key)}>
                      {f.label}
                      <span className="ml-1 text-[10px] opacity-60">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                    </th>
                    )
                  })}
                  <th className="px-3 py-2 w-24 text-center font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={STD_TABLE_COLUMNS.length + 1} className="px-4 py-8 text-center text-gray-500">
                      {search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}
                    </td>
                  </tr>
                ) : (
                  displayRows.map((r) => (
                    <Fragment key={r._id}>
                      <tr
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          expandedId === r._id ? 'bg-military-50' : 'hover:bg-military-50/40'
                        }`}
                        onClick={() => toggleExpand(r._id)}
                      >
                        {STD_TABLE_COLUMNS.map((f) => (
                          <td key={f.key} className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={String(r[f.key] ?? '')}>
                            {r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—'}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center text-xs text-military-600 ${expandedId === r._id ? 'rotate-180' : ''} transition-transform`}>
                            &#9660;
                          </span>
                        </td>
                      </tr>
                      {expandedId === r._id && (
                        <tr>
                          <td colSpan={STD_TABLE_COLUMNS.length + 1} className="bg-gray-50/80 px-4 py-4 border-b border-gray-200">
                            {renderStdDetail(r)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ===== Other tabs: standard table ===== */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-military-800 text-white text-left">
                  {tableFields.map((f) => {
                    const active = (sortKey || defaultSortKey) === f.key
                    return (
                    <th key={f.key} className="px-2 py-2 font-medium whitespace-nowrap cursor-pointer select-none hover:bg-military-700 transition-colors" onClick={() => handleSort(f.key)}>
                      {fieldLabel(f)}
                      <span className="ml-1 text-[10px] opacity-60">{active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}</span>
                    </th>
                    )
                  })}
                  <th className="px-2 py-2 w-32 text-center">{isAmedDevicesTab ? 'รายละเอียด' : 'จัดการ'}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={tableFields.length + 1} className="px-4 py-8 text-center text-gray-500">
                      {search ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}
                    </td>
                  </tr>
                ) : (
                  displayRows.map((r) => (
                    <Fragment key={r._id}>
                    <tr
                      className={`border-b border-gray-100 hover:bg-military-50/40 ${isAmedDevicesTab ? 'cursor-pointer' : ''} ${isAmedDevicesTab && expandedId === r._id ? 'bg-military-50' : ''}`}
                      onClick={isAmedDevicesTab ? () => setExpandedId(id => id === r._id ? null : r._id) : undefined}
                    >
                      {tableFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-800 max-w-[200px] truncate" title={String(r[f.key] ?? '')}>
                          {f.key === 'toSelect'
                            ? (r[f.key] ? '✓' : '—')
                            : (r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—')}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {isAmedDevicesTab && (
                          <button
                            type="button"
                            className="text-military-600 text-xs px-2 py-0.5 rounded focus-visible:outline focus-visible:outline-2"
                            aria-label={`${expandedId === r._id ? 'ยุบ' : 'แสดง'}รายละเอียด ${r.amedNo}`}
                            aria-expanded={expandedId === r._id}
                            aria-controls={`amed-detail-${r._id}`}
                            onClick={() => setExpandedId(id => id === r._id ? null : r._id)}
                          >
                            {expandedId === r._id ? '▲' : '▼'}
                          </button>
                        )}
                        {!isAmedDevicesTab && (
                          <>
                        <button
                          type="button"
                          className="text-military-700 text-xs font-medium px-2 py-0.5 rounded border border-military-200"
                          onClick={() => openEdit(r)}
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="text-red-600 text-xs ml-1 px-2 py-0.5 rounded border border-red-200"
                          onClick={() => del(r._id)}
                        >
                          ลบ
                        </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isAmedDevicesTab && expandedId === r._id && (
                      <tr id={`amed-detail-${r._id}`}>
                        <td colSpan={tableFields.length + 1} className="bg-gray-50/80 px-4 py-4 border-b border-gray-200">
                          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                            {detailFields.map(f => (
                              <div key={f.key}>
                                <dt className="text-xs text-gray-500">{fieldLabel(f)}</dt>
                                <dd className="text-sm text-gray-800 font-medium break-words">
                                  {f.key === 'toSelect'
                                    ? (r[f.key] ? '✓' : '—')
                                    : AMED_UC_KEYS.some(key => key === f.key)
                                      ? (normalizeUcOptions(r[f.key]).join(', ') || '—')
                                      : (r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—')}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <div className="mt-4 pt-3 border-t border-gray-200 flex items-center gap-2">
                        <button
                          type="button"
                          className="text-military-700 text-xs font-medium px-2 py-0.5 rounded border border-military-200"
                          onClick={() => openEdit(r)}
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="text-red-600 text-xs ml-1 px-2 py-0.5 rounded border border-red-200"
                          onClick={() => del(r._id)}
                        >
                          ลบ
                        </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal (for non-stdinstruments or adding new stdinstruments) */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-military-800">{modal === 'add' ? 'เพิ่มรายการ' : 'แก้ไขรายการ'}</h3>
            <p className="text-xs text-gray-500">หมวด: {sub.label}</p>
            <div className="space-y-2">
              {sub.fields.map((f) => {
                // For ameddevices, use dropdowns for constrained fields
                if (sub.key === 'ameddevices') {
                  const amedDropdownField = (
                    fieldKey: string,
                    options: string[],
                    refLabel: string
                  ) => {
                    if (f.key !== fieldKey) return null
                    return (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-0.5">{fieldLabel(f)}</label>
                        <select
                          className="input-field text-sm"
                          value={editing[f.key] ?? ''}
                          onChange={(e) => setEditing((o) => ({ ...o, [f.key]: e.target.value }))}
                        >
                          <option value="">— เลือก —</option>
                          {options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-0.5">ถ้าไม่มีในรายการ ให้ไปเพิ่มที่ &quot;{refLabel}&quot; ก่อน</p>
                      </div>
                    )
                  }

                  const devDrop = amedDropdownField('deviceName', refDevices, 'ชื่อเครื่องมือ')
                  if (devDrop) return devDrop

                  const unitDrop = amedDropdownField('unitName', refUnits, 'หน่วยงาน')
                  if (unitDrop) return unitDrop

                  const secDrop = amedDropdownField('section', refSections, 'แผนก / ห้อง')
                  if (secDrop) return secDrop

                  if (f.key === 'brand') {
                    const uniqueBrands = Array.from(new Set(refBrands.map(b => b.name))).sort()
                    return (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-0.5">{fieldLabel(f)}</label>
                        <select
                          className="input-field text-sm"
                          value={editing[f.key] ?? ''}
                          onChange={(e) => setEditing((o) => ({ ...o, [f.key]: e.target.value, model: '' }))}
                        >
                          <option value="">— เลือก —</option>
                          {uniqueBrands.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-0.5">ถ้าไม่มีในรายการ ให้ไปเพิ่มที่ &quot;ยี่ห้อ / แบรนด์&quot; ก่อน</p>
                      </div>
                    )
                  }

                  if (f.key === 'model') {
                    const selectedBrand = editing['brand'] || ''
                    const models = selectedBrand
                      ? Array.from(new Set(refBrands.filter(b => b.name === selectedBrand).map(b => b.model).filter(Boolean))).sort()
                      : []
                    return (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-0.5">{fieldLabel(f)}</label>
                        <select
                          className="input-field text-sm"
                          value={editing[f.key] ?? ''}
                          onChange={(e) => setEditing((o) => ({ ...o, [f.key]: e.target.value }))}
                          disabled={!selectedBrand}
                        >
                          <option value="">{selectedBrand ? '— เลือกรุ่น —' : '— เลือกยี่ห้อก่อน —'}</option>
                          {models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400 mt-0.5">ถ้าไม่มีในรายการ ให้ไปเพิ่มที่ &quot;ยี่ห้อ / แบรนด์&quot; ก่อน</p>
                      </div>
                    )
                  }

                  if (f.key === 'toSelect') {
                    return (
                      <div key={f.key} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="amed-toSelect"
                          checked={!!editing[f.key]}
                          onChange={(e) => setEditing((o) => ({ ...o, [f.key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <label htmlFor="amed-toSelect" className="text-sm text-gray-700">{fieldLabel(f)}</label>
                      </div>
                    )
                  }

                  if (AMED_UC_KEYS.some(key => key === f.key)) {
                    const selected = normalizeUcOptions(editing[f.key])
                    const update = (values: string[]) => setEditing(o => ({ ...o, [f.key]: values }))
                    return (
                      <div key={f.key} className="space-y-2">
                        <label htmlFor={`add-${f.key}`} className="block text-xs text-gray-500">{fieldLabel(f)}</label>
                        {selected.map((no, index) => (
                          <div key={no} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 min-w-0 break-words">
                              {no}{refStdNos.find(s => s.no === no)?.name ? ` — ${refStdNos.find(s => s.no === no)?.name}` : ''}
                              {index === 0 && <span className="ml-2 text-xs text-military-600">ค่าเริ่มต้น</span>}
                            </span>
                            {index > 0 && (
                              <button type="button" className="text-xs text-military-700 whitespace-nowrap"
                                onClick={() => update([no, ...selected.filter(value => value !== no)])}>
                                ใช้เป็นค่าเริ่มต้น
                              </button>
                            )}
                            <button type="button" className="text-xs text-red-600" aria-label={`ลบ ${no} จาก ${fieldLabel(f)}`}
                              onClick={() => update(selected.filter(value => value !== no))}>ลบ</button>
                          </div>
                        ))}
                        <select id={`add-${f.key}`} className="input-field text-sm" value=""
                          onChange={e => { if (e.target.value) update([...selected, e.target.value]) }}>
                          <option value="">{selected.length ? '+ เพิ่มรหัสเครื่องมือมาตรฐาน' : '— ไม่ใช้ / เลือกเพื่อเพิ่ม —'}</option>
                          {refStdNos.filter(s => !selected.includes(s.no)).map(s => (
                            <option key={s.no} value={s.no}>{s.no} — {s.name}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-400">เลือกได้หลายรหัส รหัสแรกเป็นค่าเริ่มต้นเมื่อเพิ่มข้อมูลสอบเทียบ</p>
                      </div>
                    )
                  }
                }

                // Default: text/number input
                return (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{fieldLabel(f)}</label>
                    <input
                      type={f.input === 'number' ? 'number' : 'text'}
                      step="any"
                      className="input-field text-sm"
                      value={editing[f.key] ?? ''}
                      onChange={(e) =>
                        setEditing((o) => ({
                          ...o,
                          [f.key]: f.input === 'number' && e.target.value === '' ? '' : e.target.value,
                        }))
                      }
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary text-sm">
                ยกเลิก
              </button>
              <button type="button" onClick={save} className="btn-primary text-sm">
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
