'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ISO_METHODS } from '@/lib/isoMethods'
import DeviceSelector from '@/components/DeviceSelector'
import { useHospitalWorkspace } from '@/components/HospitalWorkspace'
import SelectHospitalHint from '@/components/SelectHospitalHint'
import { displayHospitalName } from '@/lib/hospitalUnit'

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
  toSelect?: boolean
  uc1?: string
  uc2?: string
  uc3?: string
  uc4?: string
  uc5?: string
  uc6?: string
  ucT?: string
}

export default function NewRecordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { selectedHospital, loading: workspaceLoading } = useHospitalWorkspace()
  const role = (session?.user as any)?.role
  const canAddDevice = role === 'admin' || role === 'technician'
  const [creating, setCreating] = useState(false)
  const [selectedIsoCode, setSelectedIsoCode] = useState<string | null>(null)
  const selectedUnit = selectedHospital
  const hospitalTitle = selectedUnit ? (displayHospitalName(selectedUnit).title || selectedUnit) : ''

  // Calibration type
  const [calType, setCalType] = useState<'sbcal' | 'iso' | ''>('')

  // ISO — no AmedNo, just pick a method and create record directly

  useEffect(() => {
    const qCalType = searchParams.get('calType')
    if (qCalType === 'sbcal' || qCalType === 'iso') {
      setCalType(qCalType)
    }
  }, [searchParams])

  const showDeviceTable = selectedUnit && calType === 'sbcal'

  const createSbcalRecord = async (device: AmedDevice) => {
    if (creating) return
    setCreating(true)
    try {
      // Build UC defaults from AmedDevice registry (std.no only — CalibrationForm resolves full std data)
      const ucDefaults: Record<string, any> = {}
      for (const k of ['uc1','uc2','uc3','uc4','uc5','uc6'] as const) {
        if (device[k]) ucDefaults[k] = { std: { no: device[k] }, calPoints: [] }
      }
      if (device.ucT) ucDefaults.ucT = { std: { no: device.ucT }, calPoints: [] }

      const payload: Record<string, unknown> = {
        calibrationType: 'sbcal',
        deviceName: device.deviceName || '',
        deviceNameTh: device.deviceNameTh || '',
        amedNo: device.amedNo,
        unitName: device.unitName,
        section: device.section || '',
        brand: device.brand || '',
        model: device.model || '',
        serialNo: device.serialNo || '',
        hpNumber: device.hpNumber || '',
        select: device.toSelect !== false,
        deviceFromRegistry: true,
        ...ucDefaults,
      }
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

  const createIsoRecord = async (isoMethodCode: string) => {
    if (creating) return
    setCreating(true)
    setSelectedIsoCode(isoMethodCode)
    try {
      const payload: Record<string, unknown> = {
        calibrationType: 'iso',
        isoMethodCode,
        unitName: selectedUnit,
        deviceFromRegistry: false,
      }
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
    createSbcalRecord(device)
  }

  if (workspaceLoading) {
    return <p className="text-center text-gray-400 py-16">กำลังโหลด...</p>
  }

  if (!selectedUnit) {
    return (
      <SelectHospitalHint
        title="เลือกโรงพยาบาลก่อนเพิ่มข้อมูลสอบเทียบ"
        detail="ระบบทั่วไปและระบบ ISO จะถูกบันทึกเข้าหน่วยงานที่เลือกจากไซด์บาร์"
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-military-900">เพิ่มข้อมูลสอบเทียบ</h1>
      <p className="text-sm text-gray-500">หน่วยงาน: <span className="font-medium text-military-800">{hospitalTitle}</span></p>

      <div className="card space-y-2">
        <h2 className="text-sm font-semibold text-military-800">เลือกระบบสอบเทียบ</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCalType('sbcal')}
            className={`p-4 border-2 rounded-lg text-left transition-all text-sm ${
              calType === 'sbcal'
                ? 'border-military-500 bg-military-50 ring-1 ring-military-300'
                : 'border-gray-200 hover:border-military-300 hover:bg-military-50'
            }`}
          >
            <div className="font-semibold text-military-800">ระบบทั่วไป</div>
            <div className="text-xs text-gray-500 mt-0.5">เลือกจากทะเบียน AmedNo ของ รพ. นี้</div>
          </button>

          <button
            onClick={() => setCalType('iso')}
            className={`p-4 border-2 rounded-lg text-left transition-all text-sm ${
              calType === 'iso'
                ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="font-semibold text-blue-800">ระบบ ISO</div>
            <div className="text-xs text-gray-500 mt-0.5">Centrifuge, Autoclave ฯลฯ</div>
          </button>
        </div>
      </div>

      {/* sbcal: Device Table */}
      {showDeviceTable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-military-800">
              เลือกเครื่องมือแพทย์ <span className="font-normal text-gray-500">(คลิกเพื่อสร้างรายการ)</span>
            </h2>
            {canAddDevice && (
              <Link href="/hospital?add=1" className="btn-primary text-sm whitespace-nowrap shrink-0">
                + เพิ่มเครื่องมือแพทย์
              </Link>
            )}
          </div>
          <DeviceSelector
            unitName={selectedUnit}
            onSelect={handleDeviceClick}
            disabled={creating}
          />
          {creating && (
            <div className="text-center text-gray-500 text-sm py-2">กำลังสร้างรายการ...</div>
          )}
        </div>
      )}

      {/* ISO: Method Selection */}
      {selectedUnit && calType === 'iso' && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-military-800">เลือกชนิดเครื่องมือ <span className="font-normal text-gray-500">(คลิกเพื่อสร้างรายการ)</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ISO_METHODS.map(m => {
              const isSelected = selectedIsoCode === m.code
              return (
              <button
                key={m.code}
                onClick={() => createIsoRecord(m.code)}
                disabled={creating}
                className={`p-4 border-2 rounded-xl transition-all text-left ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-300'
                    : creating
                      ? 'border-gray-100 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                }`}
              >
                <div className="font-semibold text-gray-800 flex items-center gap-2">
                  {isSelected && (
                    <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {m.nameTh}
                </div>
                <div className="text-sm text-gray-500">{m.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {m.code} | {m.unit} | {m.sensorCount} sensor{m.sensorCount > 1 ? 's' : ''} | {m.readingsPerPoint} readings
                </div>
              </button>
              )
            })}
          </div>
          {creating && (
            <div className="text-center text-gray-500 text-sm py-2">กำลังสร้างรายการ...</div>
          )}
        </div>
      )}

      {selectedUnit && !calType && (
        <p className="text-sm text-gray-400 text-center py-8">กรุณาเลือกระบบสอบเทียบ</p>
      )}
    </div>
  )
}
