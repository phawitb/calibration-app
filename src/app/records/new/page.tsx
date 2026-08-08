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

export default function NewRecordPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  // Hospital selection
  const [unitRefs, setUnitRefs] = useState<UnitRef[]>([])
  const [selectedUnit, setSelectedUnit] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [unitOpen, setUnitOpen] = useState(false)
  const [userRole, setUserRole] = useState('')

  // Calibration type
  const [calType, setCalType] = useState<'sbcal' | 'iso' | ''>('')

  // ISO method selection (shown after clicking a device when calType=iso)
  const [showIsoMethods, setShowIsoMethods] = useState(false)
  const [pendingDevice, setPendingDevice] = useState<AmedDevice | null>(null)

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
        if (user.role === 'hospital_user' && user.hospitalUnit) {
          setSelectedUnit(user.hospitalUnit)
          setUnitSearch(user.hospitalUnit)
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

  const showDeviceTable = selectedUnit && calType

  const createRecord = async (device: AmedDevice, type: 'sbcal' | 'iso', isoMethodCode?: string) => {
    if (creating) return
    setCreating(true)
    try {
      const payload: Record<string, unknown> = {
        calibrationType: type,
        deviceName: device.deviceName || '',
        deviceNameTh: device.deviceNameTh || '',
        amedNo: device.amedNo,
        unitName: device.unitName,
        section: device.section || '',
        brand: device.brand || '',
        model: device.model || '',
        serialNo: device.serialNo || '',
        hpNumber: device.hpNumber || '',
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

  const handleDeviceClick = (device: AmedDevice) => {
    if (creating) return
    if (calType === 'iso') {
      setPendingDevice(device)
      setShowIsoMethods(true)
    } else {
      createRecord(device, 'sbcal')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/records" className="text-gray-400 hover:text-gray-600 transition-colors">
          &larr; ข้อมูลสอบเทียบ
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-military-800">เพิ่มข้อมูล</span>
      </div>

      <h1 className="text-xl font-bold text-military-900">เพิ่มข้อมูลสอบเทียบ</h1>

      {/* ISO Method Modal */}
      {showIsoMethods && pendingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-military-900">เลือกชนิดเครื่องมือ (ISO)</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {pendingDevice.deviceName || pendingDevice.amedNo}
                </p>
              </div>
              <button
                onClick={() => { setShowIsoMethods(false); setPendingDevice(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
              >
                &times;
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ISO_METHODS.map(m => (
                <button
                  key={m.code}
                  onClick={() => createRecord(pendingDevice, 'iso', m.code)}
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
            {creating && (
              <div className="text-center text-gray-500 text-sm py-3 border-t border-gray-100">กำลังสร้างรายการ...</div>
            )}
          </div>
        </div>
      )}

      {/* Row: Hospital + Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hospital Selection */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-military-800">1. เลือกโรงพยาบาล / หน่วยงาน</h2>
          <div className="relative">
            <input
              type="text"
              className="input-field"
              placeholder="พิมพ์เพื่อค้นหาชื่อหน่วย/โรงพยาบาล"
              value={unitSearch}
              onChange={e => {
                setUnitSearch(e.target.value)
                setUnitOpen(true)
                // Clear selection when typing
                if (selectedUnit && e.target.value !== selectedUnit) {
                  setSelectedUnit('')
                  setCalType('')
                  setShowIsoMethods(false)
                  setPendingDevice(null)
                }
              }}
              onFocus={() => setUnitOpen(true)}
              onBlur={() => setTimeout(() => setUnitOpen(false), 200)}
              disabled={userRole === 'hospital_user'}
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
            <p className="text-xs text-green-600 font-medium">
              &#10003; {selectedUnit}
            </p>
          )}
        </div>

        {/* Calibration Type Selection */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-military-800">2. เลือกระบบสอบเทียบ</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setCalType('sbcal'); setShowIsoMethods(false); setPendingDevice(null) }}
              disabled={!selectedUnit}
              className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${
                calType === 'sbcal'
                  ? 'border-military-500 bg-military-50 ring-1 ring-military-300'
                  : selectedUnit
                    ? 'border-gray-200 hover:border-military-300 hover:bg-military-50'
                    : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <div className="font-semibold text-military-800">ระบบทั่วไป</div>
              <div className="text-xs text-gray-500 mt-0.5">Uc1-Uc6 + UcT</div>
            </button>

            <button
              onClick={() => { setCalType('iso'); setShowIsoMethods(false); setPendingDevice(null) }}
              disabled={!selectedUnit}
              className={`p-3 border-2 rounded-lg text-left transition-all text-sm ${
                calType === 'iso'
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                  : selectedUnit
                    ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              <div className="font-semibold text-blue-800">ระบบ ISO</div>
              <div className="text-xs text-gray-500 mt-0.5">Centrifuge, Autoclave ฯลฯ</div>
            </button>
          </div>
          {calType && (
            <p className="text-xs text-green-600 font-medium">
              &#10003; {calType === 'iso' ? 'ระบบสอบเทียบตามมาตรฐาน ISO' : 'ระบบสอบเทียบทั่วไป'}
            </p>
          )}
        </div>
      </div>

      {/* Device Table — only shows when both hospital and type are selected */}
      {showDeviceTable && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-military-800">3. เลือกเครื่องมือแพทย์ <span className="font-normal text-gray-500">(คลิกเพื่อสร้างรายการ)</span></h2>
          <DeviceSelector
            unitName={selectedUnit}
            onSelect={handleDeviceClick}
          />
          {creating && !showIsoMethods && (
            <div className="text-center text-gray-500 text-sm py-2">กำลังสร้างรายการ...</div>
          )}
        </div>
      )}

      {!selectedUnit && (
        <p className="text-sm text-gray-400 text-center py-8">กรุณาเลือกโรงพยาบาล / หน่วยงาน เพื่อเริ่มต้น</p>
      )}
      {selectedUnit && !calType && (
        <p className="text-sm text-gray-400 text-center py-8">กรุณาเลือกระบบสอบเทียบ</p>
      )}
    </div>
  )
}
