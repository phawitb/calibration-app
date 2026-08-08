'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ISO_METHODS } from '@/lib/isoMethods'
import DeviceSelector from '@/components/DeviceSelector'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'

interface UnitRef { name?: string; thaiName?: string }
interface AmedDevice {
  _id: string
  amedNo: string
  unitName: string
  section?: string
  deviceName?: string
  deviceNameTh?: string
  brand?: string
  model?: string
  serialNo?: string
  hpNumber?: string
}

type Step = 'hospital' | 'type' | 'device' | 'iso'

export default function NewRecordPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState<Step>('hospital')

  // Step 1: Hospital selection
  const [unitRefs, setUnitRefs] = useState<UnitRef[]>([])
  const [selectedUnit, setSelectedUnit] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [userHospital, setUserHospital] = useState('')

  // Step 2: Calibration type
  const [calType, setCalType] = useState<'sbcal' | 'iso' | ''>('')

  // Step 3: Device selection
  const [selectedDevice, setSelectedDevice] = useState<AmedDevice | null>(null)

  // Load user session and unit refs
  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [unitRes, sessionRes] = await Promise.all([
        fetch('/api/reference?type=units'),
        fetch('/api/auth/session'),
      ])
      if (!mounted) return
      if (unitRes.ok) {
        const j = await unitRes.json()
        setUnitRefs(Array.isArray(j.data) ? j.data : [])
      }
      if (sessionRes.ok) {
        const s = await sessionRes.json()
        const user = s?.user || {}
        setUserRole(user.role || '')
        setUserHospital(user.hospitalUnit || '')
        // hospital_user auto-select their hospital and skip to type
        if (user.role === 'hospital_user' && user.hospitalUnit) {
          setSelectedUnit(user.hospitalUnit)
          setStep('type')
        }
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const unitOptions = useMemo(() => {
    const keyword = unitSearch.trim().toLowerCase()
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
  }, [unitRefs, unitSearch])

  const createRecord = async (type: 'sbcal' | 'iso', isoMethodCode?: string) => {
    if (creating || !selectedDevice) return
    setCreating(true)
    try {
      const payload: Record<string, unknown> = {
        calibrationType: type,
        deviceName: selectedDevice.deviceName || '',
        deviceNameTh: selectedDevice.deviceNameTh || '',
        amedNo: selectedDevice.amedNo,
        unitName: selectedDevice.unitName,
        section: selectedDevice.section || '',
        brand: selectedDevice.brand || '',
        model: selectedDevice.model || '',
        serialNo: selectedDevice.serialNo || '',
        hpNumber: selectedDevice.hpNumber || '',
        deviceFromRegistry: true,
      }
      if (type === 'iso' && isoMethodCode) payload.isoMethodCode = isoMethodCode
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

  const breadcrumbParts: { label: string; onClick?: () => void }[] = [
    { label: 'ข้อมูลสอบเทียบ' },
  ]
  if (step !== 'hospital') {
    breadcrumbParts.push({ label: 'เลือก รพ.', onClick: () => { setStep('hospital'); setCalType(''); setSelectedDevice(null) } })
  }
  if (step === 'device' || step === 'iso') {
    breadcrumbParts.push({ label: 'เลือกประเภท', onClick: () => { setStep('type'); setSelectedDevice(null) } })
  }
  if (step === 'iso') {
    breadcrumbParts.push({ label: 'เลือกเครื่องมือ', onClick: () => setStep('device') })
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/records" className="text-gray-400 hover:text-gray-600 transition-colors">
          &larr; ข้อมูลสอบเทียบ
        </Link>
        {breadcrumbParts.map((bp, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="text-gray-300">/</span>
            {bp.onClick ? (
              <button onClick={bp.onClick} className="text-gray-400 hover:text-gray-600 text-sm">
                {bp.label}
              </button>
            ) : (
              <span className="text-sm font-medium text-military-800">{bp.label}</span>
            )}
          </span>
        ))}
      </div>

      {/* Step 1: Select Hospital */}
      {step === 'hospital' && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-military-900">เลือกโรงพยาบาล / หน่วยงาน</h1>
          <div className="card max-w-xl">
            <div className="relative">
              <input
                type="text"
                className="input-field"
                placeholder="พิมพ์เพื่อค้นหาชื่อหน่วย/โรงพยาบาล"
                value={unitSearch}
                onChange={e => { setUnitSearch(e.target.value); setUnitOpen(true) }}
                onFocus={() => setUnitOpen(true)}
                onBlur={() => setTimeout(() => setUnitOpen(false), 200)}
              />
              {unitOpen && unitOptions.length > 0 && (
                <ul className="absolute z-30 mt-0.5 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-sm shadow-md">
                  {unitOptions.map(opt => (
                    <li
                      key={opt}
                      className="cursor-pointer px-3 py-2 hover:bg-gray-100"
                      onMouseDown={e => {
                        e.preventDefault()
                        setSelectedUnit(opt)
                        setUnitSearch(opt)
                        setUnitOpen(false)
                      }}
                    >
                      {opt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedUnit && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-600">เลือกแล้ว: <strong>{selectedUnit}</strong></span>
                <button
                  onClick={() => { setStep('type'); setCalType(''); setSelectedDevice(null) }}
                  className="btn-primary"
                >
                  ถัดไป
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Select Calibration Type */}
      {step === 'type' && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-military-900">เลือกระบบสอบเทียบ</h1>
          <p className="text-sm text-gray-500">หน่วยงาน: <strong>{selectedUnit}</strong></p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => { setCalType('sbcal'); setStep('device') }}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-military-500 hover:bg-military-50 transition-all text-left group"
            >
              <div className="text-lg font-bold text-military-800 group-hover:text-military-900">ระบบสอบเทียบทั่วไป</div>
              <div className="text-sm text-gray-500 mt-1">Hygrometer, Thermometer ฯลฯ</div>
              <div className="text-xs text-gray-400 mt-1">Uc1-Uc6 + UcT | 4 readings x 4-6 จุดสอบเทียบ</div>
            </button>

            <button
              onClick={() => { setCalType('iso'); setStep('device') }}
              className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="text-lg font-bold text-blue-800 group-hover:text-blue-900">ระบบสอบเทียบตามมาตรฐาน ISO</div>
              <div className="text-sm text-gray-500 mt-1">Centrifuge, Enclosure, Autoclave ฯลฯ</div>
              <div className="text-xs text-gray-400 mt-1">หลายรูปแบบตามชนิดเครื่อง | Multi-sensor support</div>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Select Device */}
      {step === 'device' && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-military-900">เลือกเครื่องมือแพทย์</h1>
          <p className="text-sm text-gray-500">
            หน่วยงาน: <strong>{selectedUnit}</strong> |{' '}
            ระบบ: <strong>{calType === 'iso' ? 'ISO' : 'ทั่วไป'}</strong>
          </p>

          <DeviceSelector
            unitName={selectedUnit}
            onSelect={d => setSelectedDevice(d)}
          />

          {selectedDevice && (
            <div className="card bg-blue-50 border-blue-200">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">ข้อมูลเครื่องมือที่เลือก</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div><span className="text-gray-500">AmedNo:</span> <strong>{selectedDevice.amedNo}</strong></div>
                <div><span className="text-gray-500">ชื่อ:</span> {selectedDevice.deviceName || '-'}</div>
                <div><span className="text-gray-500">ยี่ห้อ:</span> {selectedDevice.brand || '-'}</div>
                <div><span className="text-gray-500">รุ่น:</span> {selectedDevice.model || '-'}</div>
                <div><span className="text-gray-500">S/N:</span> {selectedDevice.serialNo || '-'}</div>
                <div><span className="text-gray-500">แผนก:</span> {selectedDevice.section || '-'}</div>
              </div>
              <div className="mt-3 flex justify-end">
                {calType === 'iso' ? (
                  <button
                    onClick={() => setStep('iso')}
                    className="btn-primary"
                  >
                    เลือกชนิดเครื่องมือ ISO
                  </button>
                ) : (
                  <button
                    onClick={() => createRecord('sbcal')}
                    disabled={creating}
                    className="btn-primary"
                  >
                    {creating ? 'กำลังสร้าง...' : 'สร้างรายการสอบเทียบ'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3b: ISO Method Selection */}
      {step === 'iso' && (
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-military-900">เลือกชนิดเครื่องมือ (ISO)</h1>
          <p className="text-sm text-gray-500">
            หน่วยงาน: <strong>{selectedUnit}</strong> |{' '}
            เครื่อง: <strong>{selectedDevice?.deviceName || selectedDevice?.amedNo}</strong>
          </p>

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
      )}
    </div>
  )
}
