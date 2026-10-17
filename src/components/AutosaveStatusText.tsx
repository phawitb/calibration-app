'use client'

import { describeAutosave, type AutosaveStatus } from '@/hooks/useDraftAutosave'

/** ข้อความสถานะบันทึกอัตโนมัติ แสดงข้างปุ่มบันทึก */
export default function AutosaveStatusText({ status }: { status: AutosaveStatus }) {
  const text = describeAutosave(status)
  if (!text) return null
  const color = status.kind === 'error' ? 'text-red-600' : status.kind === 'saving' ? 'text-amber-700' : 'text-gray-500'
  return (
    <span className={`text-xs ${color}`} role="status" aria-live="polite" data-testid="autosave-status">
      {text}
    </span>
  )
}
