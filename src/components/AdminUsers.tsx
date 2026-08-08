'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import toast from 'react-hot-toast'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'
import { removeWhiteBackground } from '@/lib/signatureUtils'
import SignaturePad from '@/components/SignaturePad'
import { useImpersonation } from '@/components/ImpersonationProvider'

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

interface UserCertMeta {
  _id: string
  fileName: string
  uploadedAt: string
}

export default function AdminUsers() {
  const { startImpersonation } = useImpersonation()
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
  const [createSigMode, setCreateSigMode] = useState<'upload' | 'draw'>('upload')
  const [editSigMode, setEditSigMode] = useState<'upload' | 'draw'>('upload')
  const [editCerts, setEditCerts] = useState<UserCertMeta[]>([])
  const [certUploading, setCertUploading] = useState(false)

  const fetchUsers = async () => {
    const res  = await fetch('/api/users', { cache: 'no-store' })
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

  /** Read image file (png/jpg/jpeg), remove white background, return PNG data URL */
  const readSignatureImage = async (file: File): Promise<string> => {
    if (file.size > 2_000_000) throw new Error('ไฟล์ใหญ่เกิน 2MB')
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(file.type)) throw new Error('รองรับเฉพาะ .png, .jpg, .jpeg')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result || ''))
      r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'))
      r.readAsDataURL(file)
    })
    return removeWhiteBackground(dataUrl)
  }

  const loadUserCerts = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/certificates`)
      if (res.ok) {
        const json = await res.json()
        setEditCerts(Array.isArray(json.data) ? json.data : [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleCertUpload = async (userId: string, file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('รองรับเฉพาะไฟล์ PDF')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 8MB')
      return
    }
    setCertUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/users/${userId}/certificates`, { method: 'POST', body: fd })
    setCertUploading(false)
    if (res.ok) {
      toast.success('อัปโหลดใบเซอร์สำเร็จ')
      await loadUserCerts(userId)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
    }
  }

  const handleCertDelete = async (userId: string, certId: string) => {
    if (!confirm('ยืนยันลบใบเซอร์นี้?')) return
    const res = await fetch(`/api/users/${userId}/certificates?certId=${certId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('ลบใบเซอร์สำเร็จ')
      await loadUserCerts(userId)
    } else {
      toast.error('ลบไม่สำเร็จ')
    }
  }

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
      await fetchUsers()
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
    setEditSigMode('upload')
    setEditCerts([])
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(u._id)}`)
      if (res.ok) {
        const d = await res.json()
        setEditSignaturePng((d.user as any)?.signaturePng || null)
      }
    } catch {
      // ignore
    }
    loadUserCerts(u._id)
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
      await fetchUsers()
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
      await fetchUsers()
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
              <select className="input-field" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="hospital_user">ผู้ใช้ รพ.</option>
                <option value="technician">จนท.สอบเทียบ</option>
                <option value="approver">ผู้อนุมัติ</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700">ลายเซ็น สำหรับ PDF</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setCreateSigMode('upload')}
                    className={`px-3 py-1 text-xs rounded border ${createSigMode === 'upload' ? 'bg-military-600 text-white' : 'border-gray-300'}`}>
                    อัปโหลดรูป
                  </button>
                  <button type="button" onClick={() => setCreateSigMode('draw')}
                    className={`px-3 py-1 text-xs rounded border ${createSigMode === 'draw' ? 'bg-military-600 text-white' : 'border-gray-300'}`}>
                    วาดลายเซ็น
                  </button>
                </div>
                {createSigMode === 'upload' ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">แนะนำรูปลายเซ็นหมึกเข้ม ฉากหลังสีขาว (PNG/JPG, ระบบจะตัดพื้นหลังขาวออกอัตโนมัติ)</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="text-sm w-full"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) { setCreateSignaturePng(null); return }
                        try {
                          setCreateSignaturePng(await readSignatureImage(file))
                          toast.success('ตัดพื้นหลังและบันทึกลายเซ็นแล้ว')
                        } catch (err: any) {
                          toast.error(err?.message || 'อัปโหลดไม่สำเร็จ')
                        }
                      }}
                    />
                  </div>
                ) : (
                  <SignaturePad
                    onSave={async (dataUrl) => {
                      const processed = await removeWhiteBackground(dataUrl)
                      setCreateSignaturePng(processed)
                      toast.success('บันทึกลายเซ็นแล้ว')
                    }}
                    onClear={() => setCreateSignaturePng(null)}
                  />
                )}
                {createSignaturePng ? (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={createSignaturePng} alt="ลายเซ็น" className="h-14 object-contain border border-gray-200 rounded bg-white" />
                    <button type="button" className="text-xs text-red-600" onClick={() => setCreateSignaturePng(null)}>ล้าง</button>
                  </div>
                ) : null}
              </div>
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
              <select className="input-field" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                <option value="hospital_user">ผู้ใช้ รพ.</option>
                <option value="technician">จนท.สอบเทียบ</option>
                <option value="approver">ผู้อนุมัติ</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-2">
                <label className="block text-sm font-medium text-gray-700">ลายเซ็น สำหรับ PDF</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setEditSigMode('upload')}
                    className={`px-3 py-1 text-xs rounded border ${editSigMode === 'upload' ? 'bg-military-600 text-white' : 'border-gray-300'}`}>
                    อัปโหลดรูป
                  </button>
                  <button type="button" onClick={() => setEditSigMode('draw')}
                    className={`px-3 py-1 text-xs rounded border ${editSigMode === 'draw' ? 'bg-military-600 text-white' : 'border-gray-300'}`}>
                    วาดลายเซ็น
                  </button>
                </div>
                {editSigMode === 'upload' ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">แนะนำรูปลายเซ็นหมึกเข้ม ฉากหลังสีขาว (PNG/JPG, ระบบจะตัดพื้นหลังขาวออกอัตโนมัติ)</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="text-sm w-full"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          setEditSignaturePng(await readSignatureImage(file))
                          setEditSignatureCleared(false)
                          toast.success('ตัดพื้นหลังและบันทึกลายเซ็นแล้ว')
                        } catch (err: any) {
                          toast.error(err?.message || 'อัปโหลดไม่สำเร็จ')
                        }
                      }}
                    />
                  </div>
                ) : (
                  <SignaturePad
                    onSave={async (dataUrl) => {
                      const processed = await removeWhiteBackground(dataUrl)
                      setEditSignaturePng(processed)
                      setEditSignatureCleared(false)
                      toast.success('บันทึกลายเซ็นแล้ว')
                    }}
                    onClear={() => { setEditSignatureCleared(true); setEditSignaturePng(null) }}
                  />
                )}
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
            {/* Certificate PDF Upload Section */}
            <div className="sm:col-span-2 border-t border-gray-200 pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">ใบเซอร์ (PDF) — อัปโหลดได้หลายไฟล์</label>
              <input
                type="file"
                accept="application/pdf"
                className="text-sm w-full mb-2"
                disabled={certUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file || !editForm._id) return
                  await handleCertUpload(editForm._id, file)
                  e.target.value = ''
                }}
              />
              {certUploading && <p className="text-xs text-gray-500">กำลังอัปโหลด...</p>}
              {editCerts.length > 0 && (
                <div className="mt-2 space-y-1">
                  {editCerts.map(c => (
                    <div key={c._id} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded">
                      <span className="text-gray-700 flex-1 truncate">{c.fileName}</span>
                      <span className="text-xs text-gray-400">{new Date(c.uploadedAt).toLocaleDateString('th-TH')}</span>
                      <a
                        href={`/api/users/${editForm._id}/certificates/${c._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        ดู
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCertDelete(editForm._id, c._id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                    {u.hasSignature && (
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
                    <button type="button" onClick={() => startImpersonation(u._id)} className="text-amber-600 hover:text-amber-800 text-xs px-2 py-1 rounded border border-amber-200 hover:bg-amber-50">สวมบทบาท</button>
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
