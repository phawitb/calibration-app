'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ISO_METHODS } from '@/lib/isoMethods'

export default function NewRecordPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<'type' | 'iso'>('type')

  const createRecord = async (calType: 'sbcal' | 'iso', isoMethodCode?: string) => {
    if (creating) return
    setCreating(true)
    try {
      const payload: any = { calibrationType: calType, deviceName: '' }
      if (calType === 'iso' && isoMethodCode) payload.isoMethodCode = isoMethodCode
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create')
      const json = await res.json()
      router.push(`/records/${json.record._id}`)
    } catch {
      toast.error('ไม่สามารถสร้างรายการใหม่ได้')
      setCreating(false)
    }
  }

  if (step === 'iso') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('type')} className="text-gray-400 hover:text-gray-600 transition-colors">
            &larr; เลือกประเภท
          </button>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-military-900">เลือกชนิดเครื่องมือ (ISO)</h1>
        </div>

        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ISO_METHODS.map(m => (
              <button
                key={m.code}
                onClick={() => createRecord('iso', m.code)}
                disabled={creating}
                className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left disabled:opacity-50"
              >
                <div className="font-semibold text-gray-800">{m.nameTh}</div>
                <div className="text-sm text-gray-500">{m.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {m.code} | {m.unit} | {m.sensorCount} sensor{m.sensorCount > 1 ? 's' : ''} | {m.readingsPerPoint} readings
                </div>
              </button>
            ))}
          </div>
        </div>

        {creating && (
          <div className="text-center text-gray-500 text-sm">กำลังสร้างรายการ...</div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/records" className="text-gray-400 hover:text-gray-600 transition-colors">
          &larr; ข้อมูลสอบเทียบ
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-military-900">เพิ่มข้อมูล</h1>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">เลือกประเภทการสอบเทียบ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => createRecord('sbcal')}
            disabled={creating}
            className="p-6 border-2 border-gray-200 rounded-xl hover:border-military-500 hover:bg-military-50 transition-all text-left group disabled:opacity-50"
          >
            <div className="text-lg font-bold text-military-800 group-hover:text-military-900">SbCal</div>
            <div className="text-sm text-gray-500 mt-1">ระบบสอบเทียบทั่วไป (Hygrometer, Thermometer ฯลฯ)</div>
            <div className="text-xs text-gray-400 mt-2">Uc1-Uc6 + UcT | 4 readings x 4-6 จุดสอบเทียบ</div>
          </button>

          <button
            onClick={() => setStep('iso')}
            disabled={creating}
            className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
          >
            <div className="text-lg font-bold text-blue-800 group-hover:text-blue-900">ISO</div>
            <div className="text-sm text-gray-500 mt-1">ระบบสอบเทียบตามมาตรฐาน ISO (Centrifuge, Enclosure, Autoclave ฯลฯ)</div>
            <div className="text-xs text-gray-400 mt-2">หลายรูปแบบตามชนิดเครื่อง | Multi-sensor support</div>
          </button>
        </div>
      </div>

      {creating && (
        <div className="text-center text-gray-500 text-sm">กำลังสร้างรายการ...</div>
      )}
    </div>
  )
}
