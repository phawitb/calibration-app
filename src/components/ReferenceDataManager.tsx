'use client'

import { useCallback, useEffect, useState } from 'react'
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
    fields: [{ key: 'name', label: 'ชื่อยี่ห้อ' }],
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
                    <tr key={r._id} className="border-b border-gray-100 hover:bg-military-50/40">
                      {tableFields.map((f) => (
                        <td key={f.key} className="px-2 py-1.5 text-gray-800 max-w-[200px] truncate" title={String(r[f.key] ?? '')}>
                          {r[f.key] != null && r[f.key] !== '' ? String(r[f.key]) : '—'}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center">
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-military-800">{modal === 'add' ? 'เพิ่มรายการ' : 'แก้ไขรายการ'}</h3>
            <p className="text-xs text-gray-500">หมวด: {sub.label}</p>
            <div className="space-y-2">
              {sub.fields.map((f) => (
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
              ))}
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
