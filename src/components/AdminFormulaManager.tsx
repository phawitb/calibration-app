'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Formula {
  _id: string
  code: string
  name: string
  description: string
  isDefault: boolean
  isActive: boolean
  confidenceLevel: number
  divisorNormal: number
  divisorRect: number
  numReadings: number
  forceK: number | null
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  confidenceLevel: 0.9545,
  divisorNormal: 2,
  divisorRect: 1.732050808,
  numReadings: 4,
  forceK: '' as string | number,
}

function FormulaConfigSummary({ f }: { f: Formula }) {
  const parts = [
    `CL: ${(f.confidenceLevel * 100).toFixed(2)}%`,
    `÷Normal: ${f.divisorNormal}`,
    `÷Rect: ${f.divisorRect.toFixed(3)}`,
    `n: ${f.numReadings}`,
    f.forceK != null ? `k=${f.forceK}` : 'k=auto',
  ]
  return <span className="text-xs text-gray-500">{parts.join(' · ')}</span>
}

export default function AdminFormulaManager() {
  const [formulas, setFormulas] = useState<Formula[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Formula | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const fetchFormulas = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/formulas')
    const data = await res.json()
    setFormulas(data.formulas || [])
    setLoading(false)
  }

  useEffect(() => { fetchFormulas() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const openEdit = (f: Formula) => {
    setEditing(f)
    setForm({
      code: f.code,
      name: f.name,
      description: f.description,
      confidenceLevel: f.confidenceLevel,
      divisorNormal: f.divisorNormal,
      divisorRect: f.divisorRect,
      numReadings: f.numReadings,
      forceK: f.forceK ?? '',
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      forceK: form.forceK === '' ? null : Number(form.forceK),
      ...(editing ? { _id: editing._id } : {}),
    }
    const res = await fetch('/api/admin/formulas', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      toast.success(editing ? 'แก้ไขสูตรสำเร็จ' : 'เพิ่มสูตรสำเร็จ')
      setShowForm(false)
      fetchFormulas()
    } else {
      const data = await res.json()
      toast.error(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  const handleToggleActive = async (f: Formula) => {
    if (f.isDefault) return
    const res = await fetch('/api/admin/formulas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: f._id, isActive: !f.isActive }),
    })
    if (res.ok) { toast.success('อัปเดตสถานะสำเร็จ'); fetchFormulas() }
  }

  const handleDelete = async (f: Formula) => {
    if (f.isDefault) { toast.error('ไม่สามารถลบสูตรมาตรฐานได้'); return }
    if (!confirm(`ยืนยันลบสูตร "${f.name}"?`)) return
    const res = await fetch(`/api/admin/formulas?id=${f._id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('ลบสูตรสำเร็จ'); fetchFormulas() }
    else toast.error('ไม่สามารถลบได้')
  }

  const fieldClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-500"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-military-900">สูตรการคำนวณ Uncertainty</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            สูตรมาตรฐานอิงมาตรฐาน GUM/JCGM 100:2008 · ห้ามแก้ไขหรือลบ
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm">
          ➕ เพิ่มสูตรใหม่
        </button>
      </div>

      {showForm && (
        <div className="card border border-military-200">
          <h4 className="font-medium text-military-800 mb-4">
            {editing ? `แก้ไขสูตร: ${editing.name}` : 'เพิ่มสูตรใหม่'}
          </h4>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>รหัสสูตร <span className="text-red-500">*</span></label>
                <input required type="text" className={fieldClass}
                  placeholder="เช่น k2_95pct"
                  value={form.code}
                  disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>ชื่อสูตร <span className="text-red-500">*</span></label>
                <input required type="text" className={fieldClass}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>ระดับความเชื่อมั่น (Confidence Level)</label>
                <input type="number" step="0.0001" min="0.5" max="0.9999" className={fieldClass}
                  value={form.confidenceLevel}
                  onChange={e => setForm(f => ({ ...f, confidenceLevel: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Divisor — Normal Distribution</label>
                <input type="number" step="0.001" min="1" className={fieldClass}
                  value={form.divisorNormal}
                  onChange={e => setForm(f => ({ ...f, divisorNormal: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>Divisor — Rectangular Distribution</label>
                <input type="number" step="0.0001" min="1" className={fieldClass}
                  value={form.divisorRect}
                  onChange={e => setForm(f => ({ ...f, divisorRect: parseFloat(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>จำนวนครั้งที่อ่านค่า (n)</label>
                <input type="number" step="1" min="2" max="10" className={fieldClass}
                  value={form.numReadings}
                  onChange={e => setForm(f => ({ ...f, numReadings: parseInt(e.target.value) }))} />
              </div>
              <div>
                <label className={labelClass}>กำหนด k ตายตัว (forceK)</label>
                <input type="number" step="0.001" min="1" className={fieldClass}
                  value={form.forceK}
                  onChange={e => setForm(f => ({ ...f, forceK: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>คำอธิบาย</label>
                <input type="text" className={fieldClass}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">ยกเลิก</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'กำลังบันทึก...' : 'บันทึกสูตร'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-military-800 text-white">
            <tr>
              <th className="text-left py-3 px-4 font-medium">สูตร</th>
              <th className="text-left py-3 px-4 font-medium">ค่าพารามิเตอร์</th>
              <th className="text-center py-3 px-4 font-medium">สถานะ</th>
              <th className="text-center py-3 px-4 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
            ) : formulas.map(f => (
              <tr key={f._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <p className="font-medium text-military-900">{f.name}</p>
                  <p className="text-xs text-gray-400">{f.code} · {f.description}</p>
                  {f.isDefault && (
                    <span className="inline-block mt-1 text-xs bg-military-100 text-military-700 px-2 py-0.5 rounded-full">
                      สูตรมาตรฐานของระบบ
                    </span>
                  )}
                </td>
                <td className="py-3 px-4"><FormulaConfigSummary f={f} /></td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${f.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {f.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    {!f.isDefault ? (
                      <>
                        <button onClick={() => openEdit(f)} className="text-military-600 hover:text-military-800 text-xs px-2 py-1 rounded border border-military-200 hover:bg-military-50">แก้ไข</button>
                        <button onClick={() => handleToggleActive(f)} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">{f.isActive ? 'ปิด' : 'เปิด'}</button>
                        <button onClick={() => handleDelete(f)} className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">ลบ</button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">ปรับแต่งไม่ได้</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
