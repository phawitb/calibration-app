'use client'
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const PIN_RE = /^\d{4,8}$/

type Props = {
  onConfirm: (pin: string) => void
  onCancel: () => void
}

/** กล่องกรอกรหัส PIN ส่วนตัวก่อนส่งขออนุมัติ (TOR 1.2.1.14) */
export default function ApprovalPinDialog({ onConfirm, onCancel }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = pin.trim()
    if (!PIN_RE.test(value)) { setError('PIN ต้องเป็นตัวเลข 4–8 หลัก'); return }
    onConfirm(value)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="approval-pin-title"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl space-y-3">
        <h2 id="approval-pin-title" className="text-base font-semibold text-military-900">ยืนยันการส่งขออนุมัติ</h2>
        <p className="text-sm text-gray-600">กรุณากรอกรหัสยืนยันส่งอนุมัติ (PIN) ส่วนตัวของคุณ</p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          className="input-field tracking-[0.4em] text-center text-lg"
          value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
          aria-label="PIN"
          aria-invalid={!!error}
        />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <p className="text-xs text-gray-500">ยังไม่มี PIN? ตั้งได้ที่เมนู “โปรไฟล์ของฉัน” → รหัสยืนยันส่งอนุมัติ (PIN)</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onCancel}>ยกเลิก</button>
          <button type="submit" className="btn-primary" disabled={!PIN_RE.test(pin)}>ยืนยัน</button>
        </div>
      </form>
    </div>
  )
}

/**
 * เปิดกล่องกรอก PIN แบบ imperative — resolve เป็น PIN หรือ null เมื่อยกเลิก
 * ใช้ครอบ fetch ที่ส่ง saveAction = 'request_approval' โดยไม่ต้องแก้ JSX ของฟอร์ม
 */
export function promptApprovalPin(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      resolve(value)
      // ปลด root หลังจบ event ปัจจุบัน เพื่อไม่ unmount ระหว่าง render
      setTimeout(() => { root.unmount(); host.remove() }, 0)
    }
    root.render(<ApprovalPinDialog onConfirm={(pin) => finish(pin)} onCancel={() => finish(null)} />)
  })
}
