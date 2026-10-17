'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { signOut } from 'next-auth/react'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changing, setChanging] = useState(false)
  const [form, setForm] = useState({ username: '', role: '', fullName: '', rank: '', hospitalUnit: '' })
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' })
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [pinForm, setPinForm] = useState({ currentPassword: '', pin: '', pinConfirm: '' })
  const [savingPin, setSavingPin] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/me')
      const json = await res.json()
      const u = json.user || {}
      setForm({
        username: u.username || '',
        role: u.role || '',
        fullName: u.fullName || u.name || '',
        rank: u.rank || '',
        hospitalUnit: u.hospitalUnit || '',
      })
      setLoading(false)
    }
    load()
    fetch('/api/me/pin', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setHasPin(!!j?.hasPin))
      .catch(() => setHasPin(null))
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: form.fullName, rank: form.rank }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('บันทึกโปรไฟล์แล้ว')
      setTimeout(() => window.location.reload(), 400)
      return
    }
    const json = await res.json().catch(() => ({}))
    toast.error(json.error || 'บันทึกไม่สำเร็จ')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChanging(true)
    const res = await fetch('/api/me/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwd),
    })
    setChanging(false)
    if (res.ok) {
      toast.success('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่')
      await signOut({ callbackUrl: '/login' })
      return
    }
    const json = await res.json().catch(() => ({}))
    toast.error(json.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
  }

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4,8}$/.test(pinForm.pin)) { toast.error('PIN ต้องเป็นตัวเลข 4–8 หลัก'); return }
    if (pinForm.pin !== pinForm.pinConfirm) { toast.error('PIN ทั้งสองช่องไม่ตรงกัน'); return }
    setSavingPin(true)
    const res = await fetch('/api/me/pin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pinForm.currentPassword, pin: pinForm.pin }),
    })
    setSavingPin(false)
    if (res.ok) {
      toast.success(hasPin ? 'เปลี่ยน PIN แล้ว' : 'ตั้ง PIN แล้ว')
      setHasPin(true)
      setPinForm({ currentPassword: '', pin: '', pinConfirm: '' })
      return
    }
    const json = await res.json().catch(() => ({}))
    toast.error(json.error || 'บันทึก PIN ไม่สำเร็จ')
  }

  if (loading) return <div className="card">กำลังโหลดโปรไฟล์...</div>

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h1 className="section-title">โปรไฟล์ของฉัน</h1>
        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-gray-600">Username</label>
            <input className="input-field bg-gray-50" value={form.username} disabled />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">สิทธิ์</label>
            <input className="input-field bg-gray-50" value={form.role} disabled />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">ยศ</label>
            <input className="input-field" value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">ชื่อ-สกุล</label>
            <input className="input-field" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">โรงพยาบาล/หน่วย</label>
            <input className="input-field bg-gray-50" value={form.hospitalUnit} disabled />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={saving} type="submit">{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="section-title">เปลี่ยนรหัสผ่าน</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-gray-600">รหัสผ่านปัจจุบัน</label>
            <input type="password" className="input-field" required value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">รหัสผ่านใหม่</label>
            <input type="password" minLength={8} className="input-field" required value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={changing} type="submit">{changing ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}</button>
          </div>
        </form>
      </div>

      <div className="card lg:col-span-2">
        <h2 className="section-title">รหัสยืนยันส่งอนุมัติ (PIN)</h2>
        <p className="text-sm text-gray-600 mb-3">
          รหัสส่วนตัว 4–8 หลัก ใช้ยืนยันตัวตนทุกครั้งก่อนส่งรายการสอบเทียบขออนุมัติ (ทุกบทบาทรวมถึงผู้ดูแลระบบ)
          {' '}สถานะ: {hasPin == null ? '—' : hasPin ? <span className="text-emerald-700 font-medium">ตั้ง PIN แล้ว</span> : <span className="text-amber-700 font-medium">ยังไม่ได้ตั้ง PIN</span>}
        </p>
        <form onSubmit={savePin} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 text-gray-600">รหัสผ่านปัจจุบัน</label>
            <input type="password" className="input-field" required autoComplete="current-password" value={pinForm.currentPassword} onChange={(e) => setPinForm((p) => ({ ...p, currentPassword: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">{hasPin ? 'PIN ใหม่' : 'PIN'} (ตัวเลข 4–8 หลัก)</label>
            <input type="password" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} className="input-field" required autoComplete="off" value={pinForm.pin} onChange={(e) => setPinForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">ยืนยัน PIN</label>
            <input type="password" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8} className="input-field" required autoComplete="off" value={pinForm.pinConfirm} onChange={(e) => setPinForm((p) => ({ ...p, pinConfirm: e.target.value.replace(/\D/g, '') }))} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="btn-primary" disabled={savingPin} type="submit">{savingPin ? 'กำลังบันทึก...' : hasPin ? 'เปลี่ยน PIN' : 'ตั้ง PIN'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
