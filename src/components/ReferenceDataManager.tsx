'use client'

import { useCallback, useEffect, useState, useMemo, Fragment } from 'react'
import toast from 'react-hot-toast'

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
]

// Key columns shown in stdinstruments table (compact view)
const STD_TABLE_COLUMNS = [
  { key: 'no', label: 'รหัส' },
  { key: 'name', label: 'ชื่อเครื่อง' },
  { key: 'measurement', label: 'การวัด' },
  { key: 'unit', label: 'หน่วย' },
]

// Detail fields shown when expanded (excluding table columns)
const STD_DETAIL_FIELDS = [
  { key: 'manufacture', label: 'ผู้ผลิต' },
  { key: 'model', label: 'รุ่น' },
  { key: 'serialNo', label: 'Serial No.' },
  { key: 'certNo', label: 'Cert. / เลขที่ใบรับรอง' },
  { key: 'calDate', label: 'วันที่สอบเทียบ' },
  { key: 'correction', label: 'Correction' },
  { key: 'uTStd', label: 'uTStd' },
  { key: 'uTDrif', label: 'uTDrif' },
  { key: 'uTResStd', label: 'uTResStd' },
  { key: 'uTUuc', label: 'uTUuc' },
  { key: 'uTInt', label: 'uTInt' },
  { key: 'expandedU', label: 'expandedU' },
]

function fieldLabel(f: { key: string; label?: string }) {
  return f.label || f.key
}

function getCertStatus(expiryDate: string | Date | undefined) {
  if (!expiryDate) return null
  const exp = new Date(expiryDate)
  const now = new Date()
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return { label: 'หมดอายุ', color: 'bg-red-100 text-red-700 border-red-300' }
  if (diffDays <= 30) return { label: 'ใกล้หมดอายุ', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' }
  return { label: 'ใช้ได้', color: 'bg-green-100 text-green-700 border-green-300' }
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
  const [cpForm, setCpForm] = useState({ points: '', stdValues: '' })

  // Inline editing for stdinstruments expanded detail
  const [stdEditing, setStdEditing] = useState(false)
  const [stdEditData, setStdEditData] = useState<Record<string, any>>({})
  const [stdSaving, setStdSaving] = useState(false)
  // Pending cal point changes (local only until save)
  const [pendingCalPoints, setPendingCalPoints] = useState<any[]>([])
  const [pendingCpAdded, setPendingCpAdded] = useState<any[]>([])   // new tables to create
  const [pendingCpDeleted, setPendingCpDeleted] = useState<string[]>([]) // ids to delete

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

  const load = useCallback(async () => {
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
        setRefStdNos((j.data || []).map((d: any) => ({ no: String(d.no || ''), name: String(d.name || '') })).filter((d: any) => d.no))
      }
    }
    loadRefs()
    return () => { mounted = false }
  }, [sub.key])

  const openAdd = () => {
    setEditId(null)
    const o: Record<string, any> = {}
    for (const f of sub.fields) o[f.key] = f.key === 'toSelect' ? false : ''
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

  // --- Std Instruments expanded detail ---
  const loadStdDetail = async (id: string) => {
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

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setStdEditing(false); return }
    setExpandedId(id)
    setStdEditing(false)
    await loadStdDetail(id)
  }

  const startStdEdit = (r: any) => {
    const data: Record<string, any> = {}
    for (const f of sub.fields) {
      const v = r[f.key]
      data[f.key] = v != null && v !== '' ? v : ''
    }
    setStdEditData(data)
    setPendingCalPoints([...stdCalPoints])
    setPendingCpAdded([])
    setPendingCpDeleted([])
    setCpFormOpen(false)
    setCpForm({ points: '', stdValues: '' })
    setStdEditing(true)
  }

  const cancelStdEdit = () => {
    setStdEditing(false)
    setCpFormOpen(false)
    setCpForm({ points: '', stdValues: '' })
  }

  const saveStdEdit = async (id: string) => {
    if (stdSaving) return
    setStdSaving(true)
    // 1) Save instrument fields
    const payload: Record<string, any> = { type: sub.type, _id: id }
    for (const f of sub.fields) {
      const v = stdEditData[f.key]
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
      const res = await fetch('/api/admin/reference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.error || 'อัปเดตไม่สำเร็จ')
      }

      // 2) Delete removed cal point tables
      for (const cpId of pendingCpDeleted) {
        await fetch(`/api/admin/stdinstruments/${id}/calpoints?configId=${cpId}`, { method: 'DELETE' })
      }

      // 3) Update existing cal point tables (points + stdValues may have been edited)
      const isTimeUnit = isExpandedTimeUnit
      const existingCps = pendingCalPoints.filter((cp: any) => !cp._isNew && !pendingCpDeleted.includes(cp._id))
      for (const cp of existingCps) {
        const cleanPoints = (cp.points || []).filter((p: any) => p.pointValue !== '' && p.pointValue != null)
        const stdArr = isTimeUnit
          ? (cp.stdValues || []).map((v: any) => v != null && v !== '' ? String(v) : '')
          : (cp.stdValues || []).map((v: any) => v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : 0)
        await fetch(`/api/admin/stdinstruments/${id}/calpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _id: cp._id, points: cleanPoints, stdValues: stdArr }),
        })
      }

      // 4) Create newly added cal point tables (use pendingCalPoints with _isNew to capture inline edits)
      const newCps = pendingCalPoints.filter((cp: any) => cp._isNew && !pendingCpDeleted.includes(cp._id))
      for (const cp of newCps) {
        const cleanPoints = (cp.points || []).filter((p: any) => p.pointValue !== '' && p.pointValue != null)
        const stdArr = isTimeUnit
          ? (cp.stdValues || []).map((v: any) => v != null && v !== '' ? String(v) : '')
          : (cp.stdValues || []).map((v: any) => v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : 0)
        await fetch(`/api/admin/stdinstruments/${id}/calpoints`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: cleanPoints, stdValues: stdArr }),
        })
      }

      // 5) Save reorder
      const existingIds = existingCps.map((cp: any) => cp._id)
      if (existingIds.length > 0) {
        await fetch(`/api/admin/stdinstruments/${id}/calpoints`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: existingIds }),
        })
      }

      toast.success('บันทึกทั้งหมดสำเร็จ')
      setStdSaving(false)
      setStdEditing(false)
      await load()
      await loadStdDetail(id)
    } catch (e: any) {
      toast.error(e?.message || 'Error')
      setStdSaving(false)
    }
  }

  const handleStdCertUpload = async (instId: string, file: File, year: number, expiryDate: string, certNo: string) => {
    setCertUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('year', String(year))
    if (certNo) fd.append('certNo', certNo)
    if (expiryDate) fd.append('expiryDate', expiryDate)
    fd.append('isLatest', 'true')
    const res = await fetch(`/api/admin/stdinstruments/${instId}/certificates`, { method: 'POST', body: fd })
    setCertUploading(false)
    if (res.ok) {
      toast.success('อัปโหลดใบเซอร์สำเร็จ')
      loadStdDetail(instId)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
    }
  }

  const handleStdCertDelete = async (instId: string, certId: string) => {
    if (!confirm('ยืนยันลบใบเซอร์?')) return
    const res = await fetch(`/api/admin/stdinstruments/${instId}/certificates?certId=${certId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('ลบแล้ว'); loadStdDetail(instId) }
    else toast.error('ลบไม่สำเร็จ')
  }

  // Check if currently expanded row is time-based measurement
  const expandedRow = rows.find((r: any) => r._id === expandedId)
  const isExpandedTimeUnit = String(expandedRow?.measurement || '').toLowerCase() === 'time'

  // --- Pending cal point operations (local state, saved on main save) ---
  const addPendingCalPoint = () => {
    const points = cpForm.points.split(',').map(s => s.trim()).filter(Boolean).map(s => ({
      pointValue: isExpandedTimeUnit ? s : Number(s),
      unit: '',
    }))
    if (points.length === 0 || (!isExpandedTimeUnit && points.some(p => isNaN(p.pointValue as number)))) {
      toast.error('กรุณาระบุ cal points คั่นด้วยจุลภาค')
      return
    }
    const stdValues = cpForm.stdValues
      ? isExpandedTimeUnit
        ? cpForm.stdValues.split(',').map(s => s.trim()).filter(Boolean)
        : cpForm.stdValues.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n))
      : []
    const tempId = `_new_${Date.now()}`
    const existingCount = pendingCalPoints.length
    const newCp = {
      _id: tempId,
      _isNew: true,
      tableName: `table${existingCount + 1}`,
      points,
      stdValues,
    }
    setPendingCalPoints(prev => [...prev, newCp])
    setPendingCpAdded(prev => [...prev, { points, stdValues }])
    setCpFormOpen(false)
    setCpForm({ points: '', stdValues: '' })
  }

  const removePendingCalPoint = (cp: any) => {
    setPendingCalPoints(prev => prev.filter(c => c._id !== cp._id))
    if (cp._isNew) {
      // Remove from added list by matching points
      setPendingCpAdded(prev => {
        const idx = prev.findIndex(a =>
          JSON.stringify(a.points) === JSON.stringify(cp.points) &&
          JSON.stringify(a.stdValues) === JSON.stringify(cp.stdValues)
        )
        if (idx >= 0) return prev.filter((_, i) => i !== idx)
        return prev
      })
    } else {
      setPendingCpDeleted(prev => [...prev, cp._id])
    }
  }

  const reorderPendingCalPoints = (fromIdx: number, toIdx: number) => {
    setPendingCalPoints(prev => {
      const reordered = [...prev]
      const [moved] = reordered.splice(fromIdx, 1)
      reordered.splice(toIdx, 0, moved)
      return reordered
    })
  }

  const isStdInstrumentsTab = sub.key === 'stdinstruments'
  const tableFields = sub.fields

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

  // Render expanded detail for stdinstruments
  const renderStdDetail = (r: any) => {
    if (stdDetailLoading) return <p className="text-sm text-gray-500 py-4">กำลังโหลด...</p>

    const isTimeMeasurement = String(r.measurement || '').toLowerCase() === 'time'

    // Sort certs by year desc (latest first)
    const sortedCerts = [...stdCerts].sort((a, b) => (b.year || 0) - (a.year || 0))
    // Cal points already sorted by order from API
    const sortedCalPoints = stdCalPoints

    return (
      <div className="space-y-5">
        {/* Detail fields */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-military-800">ข้อมูลเครื่องมือ</h4>
            <div className="flex gap-2">
              {stdEditing ? (
                <>
                  <button type="button" onClick={cancelStdEdit} disabled={stdSaving}
                    className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    ยกเลิก
                  </button>
                  <button type="button" onClick={() => saveStdEdit(r._id)} disabled={stdSaving}
                    className="text-xs px-3 py-1 rounded bg-military-700 text-white hover:bg-military-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5">
                    {stdSaving && (
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {stdSaving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => startStdEdit(r)}
                    className="text-xs px-3 py-1 rounded border border-military-300 text-military-700 hover:bg-military-50">
                    แก้ไข
                  </button>
                  <button type="button" onClick={() => del(r._id)}
                    className="text-xs px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">
                    ลบรายการ
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
            {STD_DETAIL_FIELDS.map(f => (
              <div key={f.key}>
                <span className="text-[11px] text-gray-400">{f.label}</span>
                {stdEditing ? (
                  <input
                    type={['correction','uTStd','uTDrif','uTResStd','uTUuc','uTInt','expandedU'].includes(f.key) ? 'number' : 'text'}
                    step="any"
                    className="input-field text-sm py-1"
                    value={stdEditData[f.key] ?? ''}
                    onChange={e => setStdEditData(d => ({ ...d, [f.key]: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm text-gray-800 font-medium">
                    {r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Certificates Section */}
        <div>
          <h4 className="text-sm font-semibold text-military-800 mb-2">ใบเซอร์ (Certificate PDF)</h4>

          {/* Upload form — only in edit mode */}
          {stdEditing && <div className="flex gap-3 mb-3 items-end flex-wrap bg-white p-3 rounded-lg border border-dashed border-gray-300">
            <div>
              <label className="text-[11px] text-gray-500 block mb-0.5">ปี พ.ศ.</label>
              <input type="number" id={`cert-year-${r._id}`} className="input-field text-sm w-24 py-1" placeholder="2567" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-0.5">เลขที่ใบรับรอง</label>
              <input type="text" id={`cert-no-${r._id}`} className="input-field text-sm w-40 py-1" placeholder="เลขที่ใบรับรอง" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-0.5">วันหมดอายุ</label>
              <input type="date" id={`cert-expiry-${r._id}`} className="input-field text-sm w-40 py-1" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 block mb-0.5">ไฟล์ PDF</label>
              <input
                type="file"
                accept="application/pdf"
                id={`cert-file-${r._id}`}
                className="text-xs"
                disabled={certUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const yearEl = document.getElementById(`cert-year-${r._id}`) as HTMLInputElement
                  const certNoEl = document.getElementById(`cert-no-${r._id}`) as HTMLInputElement
                  const expiryEl = document.getElementById(`cert-expiry-${r._id}`) as HTMLInputElement
                  const year = Number(yearEl?.value)
                  if (!year) { toast.error('กรุณาระบุปี'); e.target.value = ''; return }
                  handleStdCertUpload(r._id, file, year, expiryEl?.value || '', certNoEl?.value || '')
                  e.target.value = ''
                }}
              />
            </div>
            {certUploading && <span className="text-xs text-gray-500">กำลังอัปโหลด...</span>}
          </div>}

          {/* Cert list */}
          {sortedCerts.length > 0 ? (
            <div className="space-y-1">
              {sortedCerts.map((c: any, idx: number) => {
                const status = getCertStatus(c.expiryDate)
                const isActive = idx === 0 // latest year = active
                return (
                  <div key={c._id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                    isActive ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'
                  }`}>
                    <span className="font-medium text-gray-700 w-16 shrink-0">ปี {c.year}</span>
                    {c.certNo && <span className="text-gray-600 text-xs shrink-0">เลขที่ {c.certNo}</span>}
                    <span className="text-gray-500 truncate flex-1">{c.fileName}</span>
                    {isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded font-medium shrink-0">
                        ฉบับปัจจุบัน
                      </span>
                    )}
                    {status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${status.color}`}>
                        {status.label}
                        {c.expiryDate && ` (${new Date(c.expiryDate).toLocaleDateString('th-TH')})`}
                      </span>
                    )}
                    {stdEditing && <button type="button" onClick={() => handleStdCertDelete(r._id, c._id)}
                      className="text-red-400 text-xs hover:text-red-600 shrink-0">ลบ</button>}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400">ยังไม่มีใบเซอร์</p>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Cal Points Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-military-800">ตารางจุดสอบเทียบ (Cal Points)</h4>
            {stdEditing && (
              <button type="button" onClick={() => setCpFormOpen(!cpFormOpen)}
                className="text-xs px-3 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">
                {cpFormOpen ? 'ยกเลิก' : '+ เพิ่มตาราง'}
              </button>
            )}
          </div>
          {cpFormOpen && stdEditing && (
            <div className="flex gap-3 mb-3 items-end flex-wrap bg-white p-3 rounded-lg border border-dashed border-blue-300">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-gray-500 block mb-0.5">Cal Points (คั่นด้วย ,)</label>
                <input type="text" className="input-field text-sm py-1 w-full" value={cpForm.points}
                  onChange={(e) => setCpForm(f => ({ ...f, points: e.target.value }))} placeholder="20, 25, 30, 35, 40" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-[11px] text-gray-500 block mb-0.5">Std Values (คั่นด้วย ,)</label>
                <input type="text" className="input-field text-sm py-1 w-full" value={cpForm.stdValues}
                  onChange={(e) => setCpForm(f => ({ ...f, stdValues: e.target.value }))} placeholder="20.1, 25.0, 30.2, 35.1, 40.0" />
              </div>
              <button type="button" onClick={addPendingCalPoint}
                className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
                เพิ่ม
              </button>
            </div>
          )}
          {(() => {
            const displayCps = stdEditing ? pendingCalPoints : stdCalPoints
            if (displayCps.length === 0) return <p className="text-xs text-gray-400">ยังไม่มีตารางจุดสอบเทียบ</p>
            return (
              <div className="space-y-3">
                {displayCps.map((cp: any, idx: number) => {
                  const pts = cp.points || []
                  const stds = cp.stdValues || []
                  const maxLen = Math.max(pts.length, stds.length, 1)
                  return (
                    <div key={cp._id} className={`rounded-lg border overflow-hidden ${cp._isNew ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                      {/* Table header row */}
                      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                        <span className="font-mono font-semibold text-military-700 text-sm">
                          table{idx + 1}
                          {cp._isNew && <span className="ml-2 text-[10px] text-blue-600 font-normal">(ใหม่)</span>}
                        </span>
                        {stdEditing && (
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={idx === 0}
                              onClick={() => reorderPendingCalPoints(idx, idx - 1)}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1.5 py-0.5 rounded border border-gray-200 disabled:opacity-30">&#9650;</button>
                            <button type="button" disabled={idx === displayCps.length - 1}
                              onClick={() => reorderPendingCalPoints(idx, idx + 1)}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1.5 py-0.5 rounded border border-gray-200 disabled:opacity-30">&#9660;</button>
                            <button type="button" onClick={() => removePendingCalPoint(cp)}
                              className="text-red-400 text-xs hover:text-red-600 ml-1 px-1.5 py-0.5 rounded border border-red-200">ลบ</button>
                          </div>
                        )}
                      </div>
                      {/* Data table */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-3 py-1 text-left w-16">จุดที่</th>
                            <th className="px-3 py-1 text-right">Cal Point</th>
                            <th className="px-3 py-1 text-right">Std</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: maxLen }).map((_, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-3 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-3 py-1 text-right font-mono text-gray-800">
                                {stdEditing ? (
                                  <input type={isTimeMeasurement ? 'text' : 'number'} step="any"
                                    className={`${isTimeMeasurement ? 'w-28' : 'w-20'} text-right text-xs font-mono px-1 py-0.5 border border-gray-200 rounded ml-auto block`}
                                    placeholder={isTimeMeasurement ? '21:00:00' : ''}
                                    value={pts[i]?.pointValue ?? ''}
                                    onChange={e => {
                                      const val = isTimeMeasurement ? e.target.value : (e.target.value === '' ? '' : Number(e.target.value))
                                      setPendingCalPoints(prev => prev.map((c, ci) => {
                                        if (ci !== idx) return c
                                        const newPts = [...(c.points || [])]
                                        while (newPts.length <= i) newPts.push({ pointValue: '', unit: '' })
                                        newPts[i] = { ...newPts[i], pointValue: val }
                                        return { ...c, points: newPts }
                                      }))
                                    }}
                                  />
                                ) : (
                                  pts[i]?.pointValue != null && pts[i]?.pointValue !== '' ? pts[i].pointValue : '—'
                                )}
                              </td>
                              <td className="px-3 py-1 text-right font-mono text-blue-700">
                                {stdEditing ? (
                                  <input type={isTimeMeasurement ? 'text' : 'number'} step="any"
                                    className={`${isTimeMeasurement ? 'w-28' : 'w-20'} text-right text-xs font-mono px-1 py-0.5 border border-blue-200 rounded ml-auto block text-blue-700`}
                                    placeholder={isTimeMeasurement ? '21:00:00' : ''}
                                    value={stds[i] ?? ''}
                                    onChange={e => {
                                      const val = isTimeMeasurement ? e.target.value : (e.target.value === '' ? undefined : Number(e.target.value))
                                      setPendingCalPoints(prev => prev.map((c, ci) => {
                                        if (ci !== idx) return c
                                        const newStds = [...(c.stdValues || [])]
                                        while (newStds.length <= i) newStds.push(undefined as any)
                                        newStds[i] = val as any
                                        return { ...c, stdValues: newStds }
                                      }))
                                    }}
                                  />
                                ) : (
                                  stds[i] != null ? stds[i] : '—'
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      </div>
    )
  }

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
            onClick={() => { setSub(t); setExpandedId(null); setStdEditing(false); setSearch(''); setSortKey(''); setSortDir('asc') }}
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
        <button type="button" onClick={openAdd} className="btn-primary text-sm whitespace-nowrap">
          + เพิ่มรายการ
        </button>
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
                  <th className="px-2 py-2 w-32 text-center">จัดการ</th>
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
                    <tr key={r._id} className="border-b border-gray-100 hover:bg-military-50/40">
                      {tableFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-800 max-w-[200px] truncate" title={String(r[f.key] ?? '')}>
                          {f.key === 'toSelect'
                            ? (r[f.key] ? '✓' : '—')
                            : (r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—')}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center whitespace-nowrap">
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

                  if (['uc1','uc2','uc3','uc4','uc5','uc6','ucT'].includes(f.key)) {
                    return (
                      <div key={f.key}>
                        <label className="block text-xs text-gray-500 mb-0.5">{fieldLabel(f)}</label>
                        <select
                          className="input-field text-sm"
                          value={editing[f.key] ?? ''}
                          onChange={(e) => setEditing((o) => ({ ...o, [f.key]: e.target.value }))}
                        >
                          <option value="">— ไม่ใช้ —</option>
                          {refStdNos.map((s) => (
                            <option key={s.no} value={s.no}>{s.no} — {s.name}</option>
                          ))}
                        </select>
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
