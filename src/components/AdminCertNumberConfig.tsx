'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

const PRESETS = [
  { label: '003/69', pattern: '{num}/{yy}' },
  { label: '69-003', pattern: '{yy}-{num}' },
  { label: 'CERT-003/2569', pattern: 'CERT-{num}/{yyyy}' },
  { label: '003', pattern: '{num}' },
]

export default function AdminCertNumberConfig() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    pattern: '{num}/{yy}',
    startNumber: 1,
    padding: 3,
    resetByYear: true,
    certValidityMonths: 12,
    alertBeforeDays: 30,
  })

  useEffect(() => {
    let mounted = true
    fetch('/api/admin/cert-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted || !data?.config) return
        setForm({
          pattern: String(data.config.pattern || '{num}/{yy}'),
          startNumber: Number(data.config.startNumber || 1),
          padding: Number(data.config.padding || 3),
          resetByYear: !!data.config.resetByYear,
          certValidityMonths: Number(data.config.certValidityMonths || 12),
          alertBeforeDays: Number(data.config.alertBeforeDays || 30),
        })
      })
      .catch(() => {
        // keep defaults
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return <div className="card">กำลังโหลดรูปแบบเลขใบรับรอง...</div>
  }

  return (
    <div className="card space-y-4">
      <h3 className="section-title">จัดการรูปแบบเลขใบรับรอง</h3>
      <p className="text-sm text-gray-600">
        ใช้ token <code>{'{num}'}</code>, <code>{'{yy}'}</code>, <code>{'{yyyy}'}</code>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">เลือกรูปแบบสำเร็จรูป</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.pattern}
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setForm((f) => ({ ...f, pattern: p.pattern }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
          <input
            className="input-field font-mono"
            value={form.pattern}
            onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">เริ่มนับจากเลข</label>
          <input
            type="number"
            min={0}
            className="input-field"
            value={form.startNumber}
            onChange={(e) => setForm((f) => ({ ...f, startNumber: Number(e.target.value || 0) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนหลักเลขรัน</label>
          <input
            type="number"
            min={1}
            max={8}
            className="input-field"
            value={form.padding}
            onChange={(e) => setForm((f) => ({ ...f, padding: Number(e.target.value || 1) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">อายุใบเซอร์ (เดือน)</label>
          <input
            type="number"
            min={1}
            max={120}
            className="input-field"
            value={form.certValidityMonths}
            onChange={(e) => setForm((f) => ({ ...f, certValidityMonths: Number(e.target.value || 12) }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">แจ้งเตือนล่วงหน้า (วัน)</label>
          <input
            type="number"
            min={1}
            max={365}
            className="input-field"
            value={form.alertBeforeDays}
            onChange={(e) => setForm((f) => ({ ...f, alertBeforeDays: Number(e.target.value || 30) }))}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={form.resetByYear}
          onChange={(e) => setForm((f) => ({ ...f, resetByYear: e.target.checked }))}
        />
        รีเซ็ตเลขรันใหม่เมื่อเปลี่ยนปี (ใช้ร่วมกับ token ปี)
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            const res = await fetch('/api/admin/cert-config', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(form),
            })
            setSaving(false)
            if (res.ok) toast.success('บันทึกรูปแบบเลขใบรับรองแล้ว')
            else {
              const d = await res.json().catch(() => ({}))
              toast.error(d.error || 'บันทึกไม่สำเร็จ')
            }
          }}
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </div>
  )
}
