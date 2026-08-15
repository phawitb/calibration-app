'use client'

import { useHospitalWorkspace } from '@/components/HospitalWorkspace'

export default function SelectHospitalHint({
  title = 'เลือกโรงพยาบาลจากด้านซ้าย',
  detail = 'เมื่อเลือก รพ. แล้ว ระบบจะแสดงเฉพาะข้อมูลของหน่วยงานนั้นในทุกแท็บ',
}: {
  title?: string
  detail?: string
}) {
  const { setSidebarOpen } = useHospitalWorkspace()
  return (
    <div className="card max-w-xl mx-auto text-center py-12">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gold-600 mb-2">Hospital workspace</p>
      <h2 className="text-xl font-bold text-military-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-2">{detail}</p>
      <button
        type="button"
        className="btn-primary mt-6 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        เปิดรายชื่อโรงพยาบาล
      </button>
    </div>
  )
}
