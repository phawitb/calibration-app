'use client'
import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

interface User {
  _id: string
  username: string
  name: string
  fullName?: string
  rank?: string
  fullNameEn?: string
  rankEn?: string
  role: string
  hospitalUnit?: string
  createdAt: string
  hasSignature?: boolean
}

export default function AdminUsers() {
  const [users,    setUsers]    = useState<User[]>([])
  const [unitRefs, setUnitRefs] = useState<Array<{ name?: string; thaiName?: string }>>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [unitOpen, setUnitOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editUnitOpen, setEditUnitOpen] = useState(false)
  const [form,     setForm]     = useState({
    username: '',
    password: '',
    name: '',
    fullName: '',
    rank: '',
    fullNameEn: '',
    rankEn: '',
    hospitalUnit: '',
    role: 'hospital_user',
  })
  const [editForm, setEditForm] = useState({
    _id: '',
    username: '',
    name: '',
    fullName: '',
    rank: '',
    fullNameEn: '',
    rankEn: '',
    hospitalUnit: '',
    role: 'hospital_user',
    isActive: true,
  })
  const [resetPassword, setResetPassword] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [createSignaturePng, setCreateSignaturePng] = useState<string | null>(null)
  const [editSignaturePng, setEditSignaturePng] = useState<string | null>(null)
  const [editSignatureCleared, setEditSignatureCleared] = useState(false)

  const fetchUsers = async () => {
    const res  = await fetch('/api/users')
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  useEffect(() => {
    let mounted = true
    const loadUnits = async () => {
      try {
        const res = await fetch('/api/reference?type=units')
        if (!res.ok) return
        const json = await res.json()
        if (!mounted) return
        setUnitRefs(Array.isArray(json.data) ? json.data : [])
      } catch {
        // keep form usable when reference API fails
      }
    }
    loadUnits()
    return () => { mounted = false }
  }, [])

  const unitOptions = useMemo(() => {
    const keyword = String(form.hospitalUnit || '').trim().toLowerCase()
    const options = new Set<string>()
    for (const u of unitRefs) {
      const en = String(u?.name || '').trim()
      const th = String(u?.thaiName || '').trim()
      const label = formatHospitalUnitLabel(en, th)
      if (!keyword) {
        if (label) options.add(label)
        continue
      }
      if (label && label.toLowerCase().includes(keyword)) options.add(label)
      if (en && en.toLowerCase().includes(keyword)) options.add(label || en)
      if (th && th.toLowerCase().includes(keyword)) options.add(label || th)
    }
    return Array.from(options).slice(0, 50)
  }, [unitRefs, form.hospitalUnit])

  const editUnitOptions = useMemo(() => {
    const keyword = String(editForm.hospitalUnit || '').trim().toLowerCase()
    const options = new Set<string>()
    for (const u of unitRefs) {
      const en = String(u?.name || '').trim()
      const th = String(u?.thaiName || '').trim()
      const label = formatHospitalUnitLabel(en, th)
      if (!keyword) {
        if (label) options.add(label)
        continue
      }
      if (label && label.toLowerCase().includes(keyword)) options.add(label)
      if (en && en.toLowerCase().includes(keyword)) options.add(label || en)
      if (th && th.toLowerCase().includes(keyword)) options.add(label || th)
    }
    return Array.from(options).slice(0, 50)
  }, [unitRefs, editForm.hospitalUnit])

  const readPngDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.size > 600_000) {
        reject(new Error('ไฟล์ใหญ่เกิน 600KB'))
        return
      }
      if (file.type !== 'image/png') {
        reject(new Error('รองรับเฉพาะ .png'))
        return
      }
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
      r.readAsDataURL(file)
    })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        signaturePng: createSignaturePng || undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('เพิ่มผู้ใช้สำเร็จ')
      setShowForm(false)
      setForm({ username: '', password: '', name: '', fullName: '', rank: '', fullNameEn: '', rankEn: '', hospitalUnit: '', role: 'hospital_user' })
      setCreateSignaturePng(null)
      fetchUsers()
    } else {
      const data = await res.json()
      toast.error(data.error || 'เกิดข้อผิดพลาด')
    }
  }

  const startEdit = async (u: User) => {
    setEditingUserId(u._id)
    setEditForm({
      _id: u._id,
      username: u.username || '',
      name: u.name || '',
      fullName: u.fullName || u.name || '',
      rank: u.rank || '',
      fullNameEn: u.fullNameEn || '',
      rankEn: u.rankEn || '',
      hospitalUnit: u.hospitalUnit || '',
      role: u.role || 'hospital_user',
      isActive: true,
    })
    setResetPassword('')
    setEditSignatureCleared(false)
    setEditSignaturePng(null)
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(u._id)}`)
      if (res.ok) {
        const d = await res.json()
        setEditSignaturePng((d.user as any)?.signaturePng || null)
      }
    } catch {
      // ignore
    }
  }

  const cancelEdit = () => {
    setEditingUserId(null)
    setEditUnitOpen(false)
    setResetPassword('')
    setEditSignaturePng(null)
    setEditSignatureCleared(false)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload: Record<string, unknown> = {
      ...editForm,
      resetPassword: resetPassword.trim() || undefined,
    }
    if (editSignatureCleared) payload.signaturePng = null
    else if (editSignaturePng) payload.signaturePng = editSignaturePng
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('อัปเดตผู้ใช้สำเร็จ')
      cancelEdit()
      fetchUsers()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'อัปเดตไม่สำเร็จ')
    }
  }

  const handleDelete = async (u: User) => {
    if (!confirm(`ยืนยันลบผู้ใช้ ${u.username} ?`)) return
    const res = await fetch(`/api/users?id=${encodeURIComponent(u._id)}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('ลบผู้ใช้สำเร็จ')
      fetchUsers()
      return
    }
    const data = await res.json().catch(() => ({}))
    toast.error(data.error || 'ลบไม่สำเร็จ')
  }

  const handleQuickResetPassword = async (u: User) => {
    const pwd = window.prompt(`ตั้งรหัสผ่านใหม่ให้ ${u.username}`, '1234')
    if (!pwd) return
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: u._id, resetPassword: pwd }),
    })
    if (res.ok) {
      toast.success('รีเซ็ตรหัสผ่านแล้ว')
      return
    }
    const data = await res.json().catch(() => ({}))
    toast.error(data.error || 'รีเซ็ตรหัสไม่สำเร็จ')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">
          {showForm ? 'ยกเลิก' : '➕ เพิ่มผู้ใช้'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="section-title">เพิ่มผู้ใช้งานใหม่</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ (Username)</label>
              <input type="text" required className="input-field"
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input type="password" required className="input-field"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
              <input type="text" required className="input-field"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยศ</label>
              <input type="text" className="input-field"
                value={form.rank} onChange={e => setForm(f => ({ ...f, rank: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล (English)</label>
              <input type="text" className="input-field"
                value={form.fullNameEn} onChange={e => setForm(f => ({ ...f, fullNameEn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยศ (English)</label>
              <input type="text" className="input-field"
                value={form.rankEn} onChange={e => setForm(f => ({ ...f, rankEn: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">โรงพยาบาล / หน่วย</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field"
                  placeholder="พิมพ์เพื่อกรองชื่อหน่วย/โรงพยาบาล"
                  value={form.hospitalUnit}
                  onChange={e => setForm(f => ({ ...f, hospitalUnit: e.target.value }))}
                  onFocus={() => setUnitOpen(true)}
                  onBlur={() => setTimeout(() => setUnitOpen(false), 180)}
                />
                {unitOpen && unitOptions.length > 0 && (
                  <ul className="absolute z-30 mt-0.5 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-left text-sm shadow-md">
                    {unitOptions.map((opt) => (
                      <li
                        key={opt}
                        className="cursor-pointer px-2 py-1.5 hover:bg-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setForm(f => ({ ...f, hospitalUnit: opt }))
                          setUnitOpen(false)
                        }}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์</label>
              <select className="input-field" value={form.role} onChange={e => { setForm(f => ({ ...f, role: e.target.value })); if (!['technician','approver'].includes(e.target.value)) setCreateSignaturePng(null) }}>
                <option value="hospital_user">ผู้ใช้ รพ.</option>
                <option value="technician">จนท.สอบเทียบ</option>
                <option value="approver">ผู้อนุมัติ</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
            {(form.role === 'technician' || form.role === 'approver') && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ลายเซ็น สำหรับ PDF (PNG เท่านั้น)</label>
                <input
                  type="file"
                  accept="image/png"
                  className="text-sm w-full"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) { setCreateSignaturePng(null); return }
                    try {
                      setCreateSignaturePng(await readPngDataUrl(file))
                      toast.success('เลือกรูปลายเซ็นแล้ว')
                    } catch (err: any) {
                      toast.error(err?.message || 'อัปโหลดไม่สำเร็จ')
                    }
                  }}
                />
                {createSignaturePng ? (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={createSignaturePng} alt="ลายเซ็น" className="h-14 object-contain border border-gray-200 rounded bg-white" />
                    <button type="button" className="text-xs text-red-600" onClick={() => setCreateSignaturePng(null)}>ล้าง</button>
                  </div>
                ) : null}
              </div>
            )}
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingUserId && (
        <div className="card">
          <h3 className="section-title">แก้ไขผู้ใช้งาน</h3>
          <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
              <input type="text" required className="input-field"
                value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
              <input type="text" required className="input-field"
                value={editForm.fullName} onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยศ</label>
              <input type="text" className="input-field"
                value={editForm.rank} onChange={e => setEditForm(f => ({ ...f, rank: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล (English)</label>
              <input type="text" className="input-field"
                value={editForm.fullNameEn} onChange={e => setEditForm(f => ({ ...f, fullNameEn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ยศ (English)</label>
              <input type="text" className="input-field"
                value={editForm.rankEn} onChange={e => setEditForm(f => ({ ...f, rankEn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์</label>
              <select className="input-field" value={editForm.role} onChange={e => { setEditForm(f => ({ ...f, role: e.target.value })); if (!['technician','approver'].includes(e.target.value)) { setEditSignaturePng(null); setEditSignatureCleared(false) } }}>
                <option value="hospital_user">ผู้ใช้ รพ.</option>
                <option value="technician">จนท.สอบเทียบ</option>
                <option value="approver">ผู้อนุมัติ</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
            {(editForm.role === 'technician' || editForm.role === 'approver') && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">ลายเซ็น สำหรับ PDF (PNG)</label>
                <input
                  type="file"
                  accept="image/png"
                  className="text-sm w-full"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) { return }
                    try {
                      setEditSignaturePng(await readPngDataUrl(file))
                      setEditSignatureCleared(false)
                      toast.success('เลือกรูปลายเซ็นแล้ว')
                    } catch (err: any) {
                      toast.error(err?.message || 'อัปโหลดไม่สำเร็จ')
                    }
                  }}
                />
                {editSignaturePng && !editSignatureCleared ? (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={editSignaturePng} alt="ลายเซ็น" className="h-14 object-contain border border-gray-200 rounded bg-white" />
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      onClick={() => { setEditSignatureCleared(true); setEditSignaturePng(null) }}
                    >
                      ล้างลายเซ็น
                    </button>
                  </div>
                ) : (editSignatureCleared
                  ? <p className="text-xs text-amber-700 mt-1">จะลบลายเซ็นเมื่อกดบันทึก</p>
                  : null)}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">โรงพยาบาล / หน่วย</label>
              <div className="relative">
                <input
                  type="text"
                  className="input-field"
                  placeholder="พิมพ์เพื่อกรองชื่อหน่วย/โรงพยาบาล"
                  value={editForm.hospitalUnit}
                  onChange={e => setEditForm(f => ({ ...f, hospitalUnit: e.target.value }))}
                  onFocus={() => setEditUnitOpen(true)}
                  onBlur={() => setTimeout(() => setEditUnitOpen(false), 180)}
                />
                {editUnitOpen && editUnitOptions.length > 0 && (
                  <ul className="absolute z-30 mt-0.5 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-left text-sm shadow-md">
                    {editUnitOptions.map((opt) => (
                      <li
                        key={opt}
                        className="cursor-pointer px-2 py-1.5 hover:bg-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditForm(f => ({ ...f, hospitalUnit: opt }))
                          setEditUnitOpen(false)
                        }}
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">รีเซ็ตรหัสผ่าน (ไม่บังคับ)</label>
              <input type="password" minLength={4} className="input-field"
                placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน"
                value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={cancelEdit} className="btn-secondary">ยกเลิก</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-military-800 text-white">
            <tr>
              <th className="text-left py-3 px-4 font-medium">ชื่อผู้ใช้</th>
              <th className="text-left py-3 px-4 font-medium">ชื่อ-นามสกุล</th>
              <th className="text-left py-3 px-4 font-medium">สิทธิ์</th>
              <th className="text-left py-3 px-4 font-medium">โรงพยาบาล</th>
              <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">วันที่สร้าง</th>
              <th className="text-center py-3 px-4 font-medium">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
            ) : users.map(u => (
              <tr key={u._id} className="border-b border-gray-50 hover:bg-military-50">
                <td className="py-3 px-4 font-medium text-military-800">{u.username}</td>
                <td className="py-3 px-4 text-gray-600">{u.fullName || u.name}{u.rank ? ` (${u.rank})` : ''}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium w-fit ${
                      u.role === 'admin'
                        ? 'bg-gold-400/20 text-yellow-800'
                        : 'bg-military-100 text-military-700'
                    }`}>
                      {u.role === 'admin'
                        ? 'ผู้ดูแลระบบ'
                        : u.role === 'approver'
                          ? 'ผู้อนุมัติ'
                          : u.role === 'technician'
                            ? 'จนท.สอบเทียบ'
                            : 'ผู้ใช้ รพ.'}
                    </span>
                    {(u.hasSignature && (u.role === 'technician' || u.role === 'approver')) && (
                      <span className="text-[10px] text-military-600">ลายเซ็น: มี</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-600">{u.hospitalUnit || '-'}</td>
                <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">
                  {new Date(u.createdAt).toLocaleDateString('th-TH')}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-center gap-2">
                    <button type="button" onClick={() => startEdit(u)} className="btn-secondary text-xs px-2 py-1">แก้ไข</button>
                    <button type="button" onClick={() => handleQuickResetPassword(u)} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">รีเซ็ตรหัส</button>
                    <button type="button" onClick={() => handleDelete(u)} className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">ลบ</button>
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
