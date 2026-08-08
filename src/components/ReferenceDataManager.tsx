'use client'

import { useCallback, useEffect, useState, Fragment } from 'react'
import toast from 'react-hot-toast'

type RefType = string

const SUBTABS: {
  key: string
  label: string
  type: RefType
  desc: string
  /** คอลัมน์แสดงในตาราง (และฟอร์มแก้ — รวมทุกฟิลด์ที่รองรับ) */
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
    key: 'calnames',
    label: 'ชื่อผู้สอบเทียบ / Cal.',
    type: 'calnames',
    desc: 'รายชื่ออ้างอิง สำหรับ Suggest ผู้สอบ',
    fields: [
      { key: 'no', label: 'ลำดับ', input: 'number' as const },
      { key: 'name', label: 'ชื่อ' },
      { key: 'thaiName', label: 'ชื่อ (ไทย)' },
    ],
  },
  {
    key: 'calprices',
    label: 'ราคาอ้างอิง',
    type: 'calprices',
    desc: 'calPrice, mainPrice ต่อเครื่อง',
    fields: [
      { key: 'no', input: 'number' as const },
      { key: 'calPrice', input: 'number' as const },
      { key: 'mainPrice', input: 'number' as const },
      { key: 'device' },
    ],
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
    ],
  },
]

function fieldLabel(f: { key: string; label?: string }) {
  return f.label || f.key
}

export default function ReferenceDataManager() {
  const [sub, setSub] = useState(SUBTABS[0])
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Record<string, any>>({})
  const [editId, setEditId] = useState<string | null>(null)
  // Expandable detail for stdinstruments
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stdCerts, setStdCerts] = useState<any[]>([])
  const [stdCalPoints, setStdCalPoints] = useState<any[]>([])
  const [stdDetailLoading, setStdDetailLoading] = useState(false)
  const [certUploading, setCertUploading] = useState(false)
  const [cpFormOpen, setCpFormOpen] = useState(false)
  const [cpForm, setCpForm] = useState({ tableName: '', points: '' })
  // Reference options for ameddevices dropdowns
  const [refDevices, setRefDevices] = useState<string[]>([])
  const [refUnits, setRefUnits] = useState<string[]>([])
  const [refSections, setRefSections] = useState<string[]>([])
  const [refBrands, setRefBrands] = useState<{ name: string; model: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reference?type=${sub.type}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('โหลดไม่สำเร็จ')
      const j = await res.json()
      setRows(Array.isArray(j.data) ? j.data : [])
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
      const [devRes, unitRes, secRes, brandRes] = await Promise.all([
        fetch('/api/reference?type=devices'),
        fetch('/api/reference?type=units'),
        fetch('/api/reference?type=sections'),
        fetch('/api/reference?type=brands'),
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
    }
    loadRefs()
    return () => { mounted = false }
  }, [sub.key])

  const openAdd = () => {
    setEditId(null)
    const o: Record<string, any> = {}
    for (const f of sub.fields) o[f.key] = ''
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

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setStdDetailLoading(true)
    setStdCerts([])
    setStdCalPoints([])
    setCpFormOpen(false)
    try {
      const [certsRes, cpRes] = await Promise.all([
        fetch(`/api/admin/stdinstruments/${id}/certificates`),
        fetch(`/api/admin/stdinstruments/${id}/calpoints`),
      ])
      if (certsRes.ok) {
        const j = await certsRes.json()
        setStdCerts(Array.isArray(j.data) ? j.data : [])
      }
      if (cpRes.ok) {
        const j = await cpRes.json()
        setStdCalPoints(Array.isArray(j.data) ? j.data : [])
      }
    } catch { /* ignore */ }
    setStdDetailLoading(false)
  }

  const handleStdCertUpload = async (instId: string, file: File, year: number, expiryDate: string, isLatest: boolean) => {
    setCertUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('year', String(year))
    if (expiryDate) fd.append('expiryDate', expiryDate)
    fd.append('isLatest', String(isLatest))
    const res = await fetch(`/api/admin/stdinstruments/${instId}/certificates`, { method: 'POST', body: fd })
    setCertUploading(false)
    if (res.ok) {
      toast.success('อัปโหลดใบเซอร์สำเร็จ')
      toggleExpand(instId) // reload
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
    }
  }

  const handleStdCertDelete = async (instId: string, certId: string) => {
    if (!confirm('ยืนยันลบใบเซอร์?')) return
    const res = await fetch(`/api/admin/stdinstruments/${instId}/certificates?certId=${certId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('ลบแล้ว'); toggleExpand(instId) }
    else toast.error('ลบไม่สำเร็จ')
  }

  const handleSaveCalPoints = async (instId: string) => {
    if (!cpForm.tableName.trim()) { toast.error('กรุณาระบุชื่อตาราง'); return }
    const points = cpForm.points.split(',').map(s => s.trim()).filter(Boolean).map(s => ({
      pointValue: Number(s),
      unit: '',
    }))
    if (points.length === 0 || points.some(p => isNaN(p.pointValue))) {
      toast.error('กรุณาระบุ cal points เป็นตัวเลขคั่นด้วยจุลภาค')
      return
    }
    const res = await fetch(`/api/admin/stdinstruments/${instId}/calpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName: cpForm.tableName, points }),
    })
    if (res.ok) {
      toast.success('บันทึกตาราง cal points สำเร็จ')
      setCpFormOpen(false)
      setCpForm({ tableName: '', points: '' })
      toggleExpand(instId)
    } else {
      toast.error('บันทึกไม่สำเร็จ')
    }
  }

  const handleDeleteCalPoints = async (instId: string, configId: string) => {
    if (!confirm('ยืนยันลบตาราง cal points?')) return
    const res = await fetch(`/api/admin/stdinstruments/${instId}/calpoints?configId=${configId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('ลบแล้ว'); toggleExpand(instId) }
    else toast.error('ลบไม่สำเร็จ')
  }

  const getCertStatus = (expiryDate: string | Date | undefined) => {
    if (!expiryDate) return null
    const exp = new Date(expiryDate)
    const now = new Date()
    const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) return { label: 'หมดอายุ', color: 'bg-red-100 text-red-700 border-red-300' }
    if (diffDays <= 30) return { label: 'ใกล้หมดอายุ', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
    return { label: 'ใช้ได้', color: 'bg-green-100 text-green-700 border-green-300' }
  }

  const isStdInstrumentsTab = sub.key === 'stdinstruments'
  const tableFields = sub.fields

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
            onClick={() => setSub(t)}
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
      <p className="text-xs text-gray-500">{sub.desc}</p>

      <div className="flex justify-end">
        <button type="button" onClick={openAdd} className="btn-primary text-sm">
          + เพิ่มรายการ
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <p className="p-6 text-gray-500 text-sm">กำลังโหลด…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-military-800 text-white text-left">
                  {tableFields.map((f) => (
                    <th key={f.key} className="px-2 py-2 font-medium whitespace-nowrap">
                      {fieldLabel(f)}
                    </th>
                  ))}
                  <th className="px-2 py-2 w-32 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={tableFields.length + 1} className="px-4 py-8 text-center text-gray-500">
                      ยังไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <Fragment key={r._id}>
                    <tr className="border-b border-gray-100 hover:bg-military-50/40">
                      {tableFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-800 max-w-[200px] truncate" title={String(r[f.key] ?? '')}>
                          {r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
                        {isStdInstrumentsTab && (
                          <button
                            type="button"
                            className="text-blue-600 text-xs mr-1 px-2 py-0.5 rounded border border-blue-200"
                            onClick={() => toggleExpand(r._id)}
                          >
                            {expandedId === r._id ? 'ย่อ' : 'รายละเอียด'}
                          </button>
                        )}
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
                      </td>
                    </tr>
                    {/* Expanded detail row for stdinstruments */}
                    {isStdInstrumentsTab && expandedId === r._id && (
                      <tr>
                        <td colSpan={tableFields.length + 1} className="bg-gray-50 px-4 py-4">
                          {stdDetailLoading ? (
                            <p className="text-sm text-gray-500">กำลังโหลด...</p>
                          ) : (
                            <div className="space-y-4">
                              {/* Certificates Section */}
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">ใบเซอร์ (Certificate PDF)</h4>
                                <div className="flex gap-2 mb-2 items-end flex-wrap">
                                  <div>
                                    <label className="text-xs text-gray-500">ปี พ.ศ.</label>
                                    <input type="number" id={`cert-year-${r._id}`} className="input-field text-sm w-24" placeholder="2567" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">วันหมดอายุ</label>
                                    <input type="date" id={`cert-expiry-${r._id}`} className="input-field text-sm w-40" />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input type="checkbox" id={`cert-latest-${r._id}`} defaultChecked />
                                    <label htmlFor={`cert-latest-${r._id}`} className="text-xs text-gray-600">ฉบับล่าสุด</label>
                                  </div>
                                  <div>
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      id={`cert-file-${r._id}`}
                                      className="text-xs w-48"
                                      disabled={certUploading}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return
                                        const yearEl = document.getElementById(`cert-year-${r._id}`) as HTMLInputElement
                                        const expiryEl = document.getElementById(`cert-expiry-${r._id}`) as HTMLInputElement
                                        const latestEl = document.getElementById(`cert-latest-${r._id}`) as HTMLInputElement
                                        const year = Number(yearEl?.value)
                                        if (!year) { toast.error('กรุณาระบุปี'); e.target.value = ''; return }
                                        handleStdCertUpload(r._id, file, year, expiryEl?.value || '', latestEl?.checked ?? true)
                                        e.target.value = ''
                                      }}
                                    />
                                  </div>
                                </div>
                                {stdCerts.length > 0 ? (
                                  <div className="space-y-1">
                                    {stdCerts.map((c: any) => {
                                      const status = getCertStatus(c.expiryDate)
                                      return (
                                        <div key={c._id} className="flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded border border-gray-100">
                                          <span className="font-medium text-gray-700 w-16">ปี {c.year}</span>
                                          <span className="text-gray-500 truncate flex-1">{c.fileName}</span>
                                          {c.isLatest && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">ล่าสุด</span>}
                                          {status && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${status.color}`}>
                                              {status.label}
                                              {c.expiryDate && ` (${new Date(c.expiryDate).toLocaleDateString('th-TH')})`}
                                            </span>
                                          )}
                                          <button type="button" onClick={() => handleStdCertDelete(r._id, c._id)} className="text-red-500 text-xs hover:text-red-700">ลบ</button>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">ยังไม่มีใบเซอร์</p>
                                )}
                              </div>

                              {/* Cal Points Section */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="text-sm font-semibold text-gray-700">ตารางจุดสอบเทียบ (Cal Points)</h4>
                                  <button type="button" onClick={() => setCpFormOpen(!cpFormOpen)}
                                    className="text-xs px-2 py-0.5 rounded border border-blue-200 text-blue-600">
                                    {cpFormOpen ? 'ยกเลิก' : '+ เพิ่มตาราง'}
                                  </button>
                                </div>
                                {cpFormOpen && (
                                  <div className="flex gap-2 mb-2 items-end flex-wrap bg-white p-2 rounded border">
                                    <div>
                                      <label className="text-xs text-gray-500">ชื่อตาราง</label>
                                      <input type="text" className="input-field text-sm w-40" value={cpForm.tableName}
                                        onChange={(e) => setCpForm(f => ({ ...f, tableName: e.target.value }))} placeholder="เช่น Temperature" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500">จุดสอบเทียบ (คั่นด้วย ,)</label>
                                      <input type="text" className="input-field text-sm w-56" value={cpForm.points}
                                        onChange={(e) => setCpForm(f => ({ ...f, points: e.target.value }))} placeholder="20, 25, 30, 35, 40" />
                                    </div>
                                    <button type="button" onClick={() => handleSaveCalPoints(r._id)}
                                      className="btn-primary text-xs px-3 py-1.5">บันทึก</button>
                                  </div>
                                )}
                                {stdCalPoints.length > 0 ? (
                                  <div className="space-y-1">
                                    {stdCalPoints.map((cp: any) => (
                                      <div key={cp._id} className="flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded border border-gray-100">
                                        <span className="font-medium text-gray-700">{cp.tableName}</span>
                                        <span className="text-gray-500 flex-1">
                                          [{cp.points?.map((p: any) => p.pointValue).join(', ')}]
                                        </span>
                                        <button type="button" onClick={() => handleDeleteCalPoints(r._id, cp._id)}
                                          className="text-red-500 text-xs hover:text-red-700">ลบ</button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400">ยังไม่มีตารางจุดสอบเทียบ</p>
                                )}
                              </div>
                            </div>
                          )}
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

                  // deviceName → devices reference
                  const devDrop = amedDropdownField('deviceName', refDevices, 'ชื่อเครื่องมือ')
                  if (devDrop) return devDrop

                  // unitName → units reference
                  const unitDrop = amedDropdownField('unitName', refUnits, 'หน่วยงาน')
                  if (unitDrop) return unitDrop

                  // section → sections reference
                  const secDrop = amedDropdownField('section', refSections, 'แผนก / ห้อง')
                  if (secDrop) return secDrop

                  // brand → brands reference (unique brand names)
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

                  // model → filtered by selected brand
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
    </div>
  )
}
