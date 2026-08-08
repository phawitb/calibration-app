'use client'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { buildHospitalUnitOptions, normalizeHospitalUnitFromRefs } from '@/lib/hospitalUnit'
import { getIsoMethod, type IsoMethodConfig } from '@/lib/isoMethods'
import { useStepNav } from '@/lib/stepNavContext'

interface Props {
  mode: 'create' | 'edit'
  methodCode: string
  recordId?: string
  initialData?: any
}

interface UnitRef {
  name?: string
  thaiName?: string
  address?: string
}

function toDateInputValue(value: unknown): string {
  if (!value) return ''
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function normalizeInitialData(initialData?: any) {
  if (!initialData) return null
  return {
    ...initialData,
    issuedDate: toDateInputValue(initialData.issuedDate),
    receivedDate: toDateInputValue(initialData.receivedDate),
    calDate: toDateInputValue(initialData.calDate),
  }
}

const SECTIONS = [
  'Operating Room (OR)', 'Emergency Room (ER)', 'Out-patient Department (OPD)',
  'Intensive Care Unit (ICU)', 'Ward', 'Laboratory', 'Radiology', 'Other',
]

/* ---------- SuggestInput ---------- */
function SuggestInput({
  field,
  value,
  onChange,
  className = 'input-field',
  placeholder,
  extraOptions = [],
  onBlur,
  restrictToList = false,
}: {
  field: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  extraOptions?: string[]
  onBlur?: () => void
  /** จำกัดให้เลือกได้เฉพาะค่าใน list — blur แล้วค่าไม่ตรงจะล้าง */
  restrictToList?: boolean
}) {
  const [options, setOptions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const safeValue = String(value ?? '')
  const mergedOptions = useMemo(
    () => Array.from(new Set([...(extraOptions || []), ...options])).filter(Boolean),
    [extraOptions, options]
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ field, q: value || '', limit: '20' })
        const res = await fetch(`/api/records/suggestions?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) return
        const json = await res.json()
        setOptions(Array.isArray(json.suggestions) ? json.suggestions : [])
      } catch { /* ignore */ }
    }, 250)
    return () => { controller.abort(); clearTimeout(timeout) }
  }, [field, value])

  const filtered = useMemo(() => {
    if (!safeValue.trim()) return mergedOptions.slice(0, 40)
    const q = safeValue.toLowerCase()
    return mergedOptions.filter((o) => o.toLowerCase().includes(q)).slice(0, 40)
  }, [safeValue, mergedOptions])

  const showList = open && filtered.length > 0

  return (
    <div className="relative">
      <input
        type="text"
        className={className}
        placeholder={placeholder}
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (restrictToList && mergedOptions.length > 0) {
            const match = mergedOptions.find((o) => o.toLowerCase() === safeValue.trim().toLowerCase())
            if (safeValue.trim() && !match) onChange('')
          }
          onBlur?.(); setTimeout(() => setOpen(false), 180)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && filtered.length) {
            e.preventDefault(); e.stopPropagation()
            onChange(filtered[0]); setOpen(false); return
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        autoComplete="off"
      />
      {showList && (
        <ul className="absolute z-30 mt-0.5 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-left text-sm shadow-md" role="listbox">
          {filtered.map((opt) => (
            <li key={opt} role="option" className="cursor-pointer px-2 py-1.5 hover:bg-gray-100"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false) }}>
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------- helpers ---------- */
function buildInitialIsoData(method: IsoMethodConfig) {
  return {
    receivedNumber: '',
    certificateNo: '',
    idNumber: '',
    uucResolution: '',
    condition: '',
    calibrationPlace: 'onsite' as string,
    referenceStandard: '',
    startTime: '',
    endTime: '',
    sensorType: '',
    probeCount: 1,
    calPoints: Array.from({ length: method.defaultCalPoints }, () => ({
      point: '',
      sensorReadings: Array.from({ length: method.readingsPerPoint }, () =>
        Array(method.sensorCount).fill('')
      ),
      standardCorrection: 0,
    })),
    timeCheck: method.hasTimeCheck
      ? { uucTime: Array(5).fill(''), stdTime: Array(5).fill('') }
      : undefined,
  }
}

function buildInitialState(method: IsoMethodConfig, methodCode: string) {
  return {
    calibrationType: 'iso' as const,
    isoMethodCode: methodCode,
    amedNo: '',
    unitName: '', address: '', section: '',
    deviceName: method.deviceType,
    brand: '', model: '', serialNo: '',
    receivedDate: '', calDate: '', issuedDate: '',
    location: '', lapTemp: '', lapHumid: '',
    calibrate: '', calPrice: '', mainPrice: '',
    receivedN: '',
    isoData: buildInitialIsoData(method),
    approvalStatus: 'draft',
    requestedApproverId: '',
    requestedApproverName: '',
    remarks: ['', '', '', ''],
  }
}

/* ---------- main component ---------- */
export default function IsoCalibrationForm({ mode, methodCode, recordId, initialData }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { goToNext } = useStepNav()
  const role = (session?.user as any)?.role as string | undefined
  const canSubmitForApproval = role === 'admin' || role === 'technician'
  const isReadOnly = role === 'hospital_user'

  const method = getIsoMethod(methodCode)

  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [canRequestApprovalNow, setCanRequestApprovalNow] = useState(false)
  const pendingContinueRef = useRef(false)
  const [unitRefs, setUnitRefs] = useState<UnitRef[]>([])
  const [addressFromRef, setAddressFromRef] = useState(false)
  const [stdInstruments, setStdInstruments] = useState<Record<string, any>[]>([])
  const [std1FromRef, setStd1FromRef] = useState(false)
  const [approvers, setApprovers] = useState<Array<{ _id: string; fullName?: string; name?: string; rank?: string; fullNameEn?: string; rankEn?: string; role?: string }>>([])

  const [data, setData] = useState<any>(() => {
    if (initialData) return normalizeInitialData(initialData) || initialData
    if (!method) return { calibrationType: 'iso', isoMethodCode: methodCode }
    return buildInitialState(method, methodCode)
  })

  const set = (field: string, value: any) => setData((d: any) => ({ ...d, [field]: value }))
  const setIso = (field: string, value: any) =>
    setData((d: any) => ({ ...d, isoData: { ...(d.isoData || {}), [field]: value } }))

  // Load record in edit mode (only if no initialData was passed)
  useEffect(() => {
    if (mode !== 'edit' || !recordId || initialData) return
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch(`/api/records/${recordId}`)
        if (!res.ok) return
        const json = await res.json()
        const rec = json.record || json
        if (mounted) setData(normalizeInitialData(rec) || rec)
      } catch { /* ignore */ }
    }
    load()
    return () => { mounted = false }
  }, [mode, recordId, initialData])

  // Load reference data
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          fetch('/api/reference?type=units'),
          fetch('/api/reference?type=stdinstruments'),
        ])
        if (uRes.ok) {
          const json = await uRes.json()
          if (mounted) setUnitRefs(Array.isArray(json.data) ? json.data : [])
        }
        if (sRes.ok) {
          const json = await sRes.json()
          if (mounted) setStdInstruments(Array.isArray(json.data) ? json.data : [])
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Load approvers
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/users/approvers')
        if (res.ok) {
          const json = await res.json()
          if (mounted) setApprovers(Array.isArray(json.users) ? json.users : [])
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { mounted = false }
  }, [])

  // Set calibrator name from session on create
  useEffect(() => {
    if (mode !== 'create') return
    const user = session?.user as any
    if (!user) return
    setData((d: any) => {
      const updates: any = {}
      if (!String(d.calibrate || '').trim()) {
        const fullEn = String(user.fullNameEn || '').trim()
        const rankEn = String(user.rankEn || '').trim()
        const fullTh = String(user.fullName || user.name || '').trim()
        const rankTh = String(user.rank || '').trim()
        updates.calibrate = fullEn
          ? `${rankEn ? `${rankEn} ` : ''}${fullEn}`.trim()
          : `${rankTh ? `${rankTh} ` : ''}${fullTh}`.trim()
      }
      if (user.amedNo && !String(d.amedNo || '').trim()) {
        updates.amedNo = user.amedNo
      }
      return Object.keys(updates).length ? { ...d, ...updates } : d
    })
  }, [session, mode])

  // Auto-fill amedNo from session in edit mode too (if blank)
  useEffect(() => {
    const user = session?.user as any
    if (!user?.amedNo) return
    setData((d: any) => {
      if (String(d.amedNo || '').trim()) return d
      return { ...d, amedNo: user.amedNo }
    })
  }, [session])

  // Allow requesting approval after saving
  useEffect(() => {
    if (mode !== 'edit') return
    if (searchParams.get('justSaved') === '1') setCanRequestApprovalNow(true)
  }, [mode, searchParams])

  const unitNameExtraOptions = useMemo(() => {
    const labels = buildHospitalUnitOptions(unitRefs)
    const keyword = String(data.unitName || '').trim().toLowerCase()
    if (!keyword) return labels.slice(0, 100)
    return labels.filter((o) => o.toLowerCase().includes(keyword)).slice(0, 100)
  }, [unitRefs, data.unitName])

  const handleUnitNameChange = (unitName: string) => {
    const normalizedLabel = normalizeHospitalUnitFromRefs(unitName, unitRefs)
    set('unitName', normalizedLabel)
    const normalized = normalizedLabel.trim().toLowerCase()
    const selected = unitRefs.find((u) =>
      [u?.name, u?.thaiName, `${u?.name || ''}(${u?.thaiName || ''})`].some(
        (v) => String(v || '').trim().toLowerCase() === normalized
      )
    )
    if (selected?.address) {
      set('address', String(selected.address))
      setAddressFromRef(true)
    } else {
      setAddressFromRef(false)
    }
    set('location', normalizedLabel)
  }

  // Std1 instrument helpers
  const setStd1 = (field: string, value: any) =>
    setData((d: any) => ({ ...d, std1: { ...(d.std1 || {}), [field]: value } }))

  const std1FieldOptions = useMemo(() => {
    const keys = ['no', 'name', 'manufacture', 'model', 'serialNo', 'certNo', 'measurement', 'unit', 'calDate'] as const
    const m: Record<string, string[]> = {}
    for (const k of keys) {
      m[k] = Array.from(
        new Set(stdInstruments.map((r) => String(r?.[k] ?? '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'th'))
    }
    return m
  }, [stdInstruments])

  const buildStdFromRef = (ref: Record<string, any>) => ({
    no: ref?.no != null ? String(ref.no) : '',
    name: ref?.name != null ? String(ref.name) : '',
    manufacture: ref?.manufacture != null ? String(ref.manufacture) : '',
    model: ref?.model != null ? String(ref.model) : '',
    serialNo: ref?.serialNo != null ? String(ref.serialNo) : '',
    certNo: ref?.certNo != null ? String(ref.certNo) : '',
    measurement: ref?.measurement != null ? String(ref.measurement) : '',
    unit: ref?.unit != null ? String(ref.unit) : '',
    calDate: ref?.calDate != null ? String(ref.calDate) : '',
    correction: ref?.correction != null && !Number.isNaN(Number(ref.correction)) ? Number(ref.correction) : undefined,
    uTStd: ref?.uTStd != null && !Number.isNaN(Number(ref.uTStd)) ? Number(ref.uTStd) : undefined,
    uTDrif: ref?.uTDrif != null && !Number.isNaN(Number(ref.uTDrif)) ? Number(ref.uTDrif) : undefined,
    uTResStd: ref?.uTResStd != null && !Number.isNaN(Number(ref.uTResStd)) ? Number(ref.uTResStd) : undefined,
    uTUuc: ref?.uTUuc != null && !Number.isNaN(Number(ref.uTUuc)) ? Number(ref.uTUuc) : undefined,
    uTInt: ref?.uTInt != null && !Number.isNaN(Number(ref.uTInt)) ? Number(ref.uTInt) : undefined,
  })

  const tryApplyStd1FromRef = () => {
    if (!stdInstruments.length) return
    setData((d: any) => {
      const s = d.std1 || {}
      const n = String(s.no ?? '').trim()
      const na = String(s.name ?? '').trim()
      if (!n && !na) return d
      const ref =
        (n && stdInstruments.find((r) => String(r?.no ?? '').trim() === n)) ||
        (na && stdInstruments.find((r) => String(r?.name ?? '').trim() === na)) ||
        null
      if (!ref) return d
      setStd1FromRef(true)
      return { ...d, std1: { ...buildStdFromRef(ref), tMin: s.tMin, tMax: s.tMax, hMin: s.hMin, hMax: s.hMax } }
    })
  }

  const clearStd1Ref = () => {
    setStd1FromRef(false)
    setData((d: any) => ({ ...d, std1: {} }))
  }

  const onFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const t = e.target
    if (!(t instanceof HTMLElement)) { e.preventDefault(); return }
    if (t.tagName === 'TEXTAREA') return
    if (t.tagName === 'BUTTON' && (t as HTMLButtonElement).type === 'submit') return
    e.preventDefault()
  }

  const REQUIRED_FIELDS = [
    { key: 'deviceName', label: 'ชื่อเครื่องมือ' },
    { key: 'unitName', label: 'โรงพยาบาล / หน่วยงาน' },
    { key: 'calDate', label: 'วันที่สอบเทียบ' },
  ]

  const validateRequired = () => {
    const errors: Record<string, string> = {}
    for (const f of REQUIRED_FIELDS) {
      if (!String(data[f.key] || '').trim()) {
        errors[f.key] = `กรุณากรอก${f.label}`
      }
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error(`กรุณากรอก: ${REQUIRED_FIELDS.filter(f => errors[f.key]).map(f => f.label).join(', ')}`)
      return false
    }
    return true
  }

  /** ตรวจสอบว่ามีข้อมูลเพียงพอสำหรับการคำนวณ ISO */
  const validateForCalculation = () => {
    const errors: Record<string, string> = {}
    const std1 = data.std1 || {}
    const isoCalPoints = data.isoData?.calPoints || []

    // ต้องมีเครื่องมือมาตรฐาน
    if (!String(std1.no || '').trim()) {
      errors['std1.no'] = 'กรุณาเลือกเครื่องมือมาตรฐาน (Standard Instrument)'
    }

    // ต้องมี calPoints อย่างน้อย 1 จุดที่มี readings
    const hasReadings = isoCalPoints.some((cp: any) => {
      if (!cp?.sensorReadings || !Array.isArray(cp.sensorReadings)) return false
      return cp.sensorReadings.some((row: any[]) =>
        Array.isArray(row) && row.some((v: any) => v !== '' && v != null && !isNaN(Number(v)) && Number(v) !== 0)
      )
    })
    if (!hasReadings) {
      errors['iso.readings'] = 'กรุณากรอกค่า Readings อย่างน้อย 1 จุดสอบเทียบ'
    }

    // ต้องมี calPoint value
    const hasPoint = isoCalPoints.some((cp: any) => {
      const p = Number(cp?.point ?? NaN)
      return !isNaN(p) && p !== 0
    })
    if (!hasPoint) {
      errors['iso.point'] = 'กรุณากรอกค่าจุดสอบเทียบ (Cal. Point) อย่างน้อย 1 จุด'
    }

    return errors
  }

  // ล้าง error เมื่อกรอกข้อมูล
  useEffect(() => {
    if (Object.keys(fieldErrors).length === 0) return
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (!key.includes('.') && String(data[key] || '').trim()) delete next[key]
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [data, fieldErrors])

  const submit = async (saveAction: 'draft' | 'request_approval') => {
    if (isReadOnly) { toast.error('สิทธิ์ผู้ใช้ รพ. ดูข้อมูลได้อย่างเดียว'); return }
    if (!validateRequired()) { pendingContinueRef.current = false; return }
    // When navigating to calc step, validate calculation data
    if (pendingContinueRef.current) {
      const calcErrors = validateForCalculation()
      if (Object.keys(calcErrors).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...calcErrors }))
        const msgs = Object.values(calcErrors)
        toast.error(msgs[0])
        pendingContinueRef.current = false
        return
      }
    }
    if (saveAction === 'request_approval' && canSubmitForApproval && !data.requestedApproverId) {
      toast.error('กรุณาเลือกผู้อนุมัติ'); return
    }
    if (saveAction === 'request_approval' && mode === 'edit' && !canRequestApprovalNow) {
      toast.error('กรุณากดอัพเดทค่า ก่อน'); return
    }
    setSaving(true)

    const selectedApprover = approvers.find((a) => String(a._id) === String(data.requestedApproverId || ''))
    const payload: any = {
      ...data,
      saveAction,
      requestedApproverName:
        saveAction === 'request_approval' && selectedApprover
          ? `${selectedApprover.rankEn || selectedApprover.rank || ''} ${selectedApprover.fullNameEn || selectedApprover.fullName || selectedApprover.name || ''}`.trim()
          : data.requestedApproverName || '',
    }

    const url = mode === 'create' ? '/api/records' : `/api/records/${recordId}`
    const httpMethod = mode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method: httpMethod,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      if (saveAction === 'request_approval') {
        toast.success('ส่งขออนุมัติใบเซอร์แล้ว')
      } else {
        toast.success(mode === 'create' ? 'บันทึกข้อมูลสำเร็จ' : 'อัพเดตข้อมูลสำเร็จ')
      }
      const json = await res.json()
      if (mode === 'create') {
        router.push(`/records/${json.record._id}?justSaved=1`)
      } else if (json.record) {
        setData((d: any) => ({ ...d, ...json.record }))
        if (saveAction === 'draft') setCanRequestApprovalNow(true)
      }
      if (pendingContinueRef.current) {
        pendingContinueRef.current = false
        goToNext()
      }
    } else {
      pendingContinueRef.current = false
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  /* ---------- cal point helpers ---------- */
  const isoData = data.isoData || {}
  const calPoints: any[] = isoData.calPoints || []

  const updateCalPoint = (ptIdx: number, field: string, value: any) => {
    const pts = [...calPoints]
    pts[ptIdx] = { ...pts[ptIdx], [field]: value }
    setIso('calPoints', pts)
  }

  const updateSensorReading = (ptIdx: number, readingIdx: number, sensorIdx: number, value: string) => {
    const pts = [...calPoints]
    const pt = { ...pts[ptIdx] }
    const readings = pt.sensorReadings.map((r: string[]) => [...r])
    readings[readingIdx][sensorIdx] = value
    pt.sensorReadings = readings
    pts[ptIdx] = pt
    setIso('calPoints', pts)
  }

  const addCalPoint = () => {
    if (!method) return
    const pts = [...calPoints, {
      point: '',
      sensorReadings: Array.from({ length: method.readingsPerPoint }, () =>
        Array(method.sensorCount).fill('')
      ),
      standardCorrection: 0,
    }]
    setIso('calPoints', pts)
  }

  const removeCalPoint = (idx: number) => {
    if (calPoints.length <= 1) return
    const pts = calPoints.filter((_: any, i: number) => i !== idx)
    setIso('calPoints', pts)
  }

  if (!method) {
    return (
      <div className="card">
        <p className="text-red-600">ไม่พบวิธีการสอบเทียบ ISO สำหรับรหัส: {methodCode}</p>
        <button type="button" onClick={() => router.back()} className="btn-secondary mt-4">กลับ</button>
      </div>
    )
  }

  /* ---------- render calibration readings ---------- */
  const renderCalibrationReadings = () => {
    if (method.measurementType === 'speed') {
      // Centrifuge: cal point + UUC readings + STD readings
      return (
        <div className="space-y-4">
          {calPoints.map((pt: any, ptIdx: number) => (
            <div key={ptIdx} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-military-700">จุดสอบเทียบที่ {ptIdx + 1}</h5>
                {calPoints.length > 1 && (
                  <button type="button" onClick={() => removeCalPoint(ptIdx)}
                    className="text-xs text-red-500 hover:text-red-700">ลบ</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cal. Point ({method.unit})</label>
                  <input type="number" className="input-field text-sm"
                    value={pt.point || ''}
                    onChange={(e) => updateCalPoint(ptIdx, 'point', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Std Correction</label>
                  <input type="number" step="any" className="input-field text-sm"
                    value={pt.standardCorrection ?? 0}
                    onChange={(e) => updateCalPoint(ptIdx, 'standardCorrection', Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-2 py-1 text-left">Reading</th>
                      <th className="border border-gray-200 px-2 py-1">UUC ({method.unit})</th>
                      <th className="border border-gray-200 px-2 py-1">STD ({method.unit})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: method.readingsPerPoint }).map((_, rIdx) => (
                      <tr key={rIdx}>
                        <td className="border border-gray-200 px-2 py-1 text-center font-medium">{rIdx + 1}</td>
                        <td className="border border-gray-200 p-0.5">
                          <input type="number" step="any" className="w-full px-1 py-0.5 text-center outline-none"
                            value={pt.sensorReadings?.[rIdx]?.[0] || ''}
                            onChange={(e) => updateSensorReading(ptIdx, rIdx, 0, e.target.value)} />
                        </td>
                        <td className="border border-gray-200 p-0.5 bg-gray-50 text-center">
                          {pt.point && !Number.isNaN(Number(pt.point))
                            ? (Number(pt.point) + (pt.standardCorrection || 0)).toFixed(1)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <button type="button" onClick={addCalPoint}
            className="text-sm text-blue-600 hover:text-blue-800">+ เพิ่มจุดสอบเทียบ</button>
        </div>
      )
    }

    if (method.measurementType === 'temperature_multi_sensor') {
      // Enclosure/Bath/Autoclave: readingsPerPoint rows x sensorCount columns per cal point
      return (
        <div className="space-y-4">
          {calPoints.map((pt: any, ptIdx: number) => (
            <div key={ptIdx} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-medium text-military-700">จุดสอบเทียบที่ {ptIdx + 1}</h5>
                {calPoints.length > 1 && (
                  <button type="button" onClick={() => removeCalPoint(ptIdx)}
                    className="text-xs text-red-500 hover:text-red-700">ลบ</button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Set Point ({method.unit})</label>
                  <input type="number" step="any" className="input-field text-sm"
                    value={pt.point || ''}
                    onChange={(e) => updateCalPoint(ptIdx, 'point', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Std Correction</label>
                  <input type="number" step="any" className="input-field text-sm"
                    value={pt.standardCorrection ?? 0}
                    onChange={(e) => updateCalPoint(ptIdx, 'standardCorrection', Number(e.target.value) || 0)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-2 py-1 text-left w-12">No.</th>
                      {Array.from({ length: method.sensorCount }).map((_, sIdx) => (
                        <th key={sIdx} className="border border-gray-200 px-2 py-1">
                          Sensor {sIdx + 1} ({method.unit})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: method.readingsPerPoint }).map((_, rIdx) => (
                      <tr key={rIdx}>
                        <td className="border border-gray-200 px-2 py-1 text-center font-medium">{rIdx + 1}</td>
                        {Array.from({ length: method.sensorCount }).map((_, sIdx) => (
                          <td key={sIdx} className="border border-gray-200 p-0.5">
                            <input type="number" step="any" className="w-full px-1 py-0.5 text-center outline-none"
                              value={pt.sensorReadings?.[rIdx]?.[sIdx] || ''}
                              onChange={(e) => updateSensorReading(ptIdx, rIdx, sIdx, e.target.value)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <button type="button" onClick={addCalPoint}
            className="text-sm text-blue-600 hover:text-blue-800">+ เพิ่มจุดสอบเทียบ</button>
        </div>
      )
    }

    // temperature (DTM): cal point + readingsPerPoint rows, single sensor
    return (
      <div className="space-y-4">
        {calPoints.map((pt: any, ptIdx: number) => (
          <div key={ptIdx} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-military-700">จุดสอบเทียบที่ {ptIdx + 1}</h5>
              {calPoints.length > 1 && (
                <button type="button" onClick={() => removeCalPoint(ptIdx)}
                  className="text-xs text-red-500 hover:text-red-700">ลบ</button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cal. Point ({method.unit})</label>
                <input type="number" step="any" className="input-field text-sm"
                  value={pt.point || ''}
                  onChange={(e) => updateCalPoint(ptIdx, 'point', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Std Correction</label>
                <input type="number" step="any" className="input-field text-sm"
                  value={pt.standardCorrection ?? 0}
                  onChange={(e) => updateCalPoint(ptIdx, 'standardCorrection', Number(e.target.value) || 0)} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-2 py-1 text-left">Reading</th>
                    <th className="border border-gray-200 px-2 py-1">UUC ({method.unit})</th>
                    <th className="border border-gray-200 px-2 py-1">STD ({method.unit})</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: method.readingsPerPoint }).map((_, rIdx) => (
                    <tr key={rIdx}>
                      <td className="border border-gray-200 px-2 py-1 text-center font-medium">{rIdx + 1}</td>
                      <td className="border border-gray-200 p-0.5">
                        <input type="number" step="any" className="w-full px-1 py-0.5 text-center outline-none"
                          value={pt.sensorReadings?.[rIdx]?.[0] || ''}
                          onChange={(e) => updateSensorReading(ptIdx, rIdx, 0, e.target.value)} />
                      </td>
                      <td className="border border-gray-200 p-0.5 bg-gray-50 text-center">
                        {pt.point && !Number.isNaN(Number(pt.point))
                          ? (Number(pt.point) + (pt.standardCorrection || 0)).toFixed(2)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <button type="button" onClick={addCalPoint}
          className="text-sm text-blue-600 hover:text-blue-800">+ เพิ่มจุดสอบเทียบ</button>
      </div>
    )
  }

  /* ---------- render time check ---------- */
  const renderTimeCheck = () => {
    if (!method.hasTimeCheck) return null
    const tc = isoData.timeCheck || { uucTime: Array(5).fill(''), stdTime: Array(5).fill('') }
    const updateTimeCheck = (field: 'uucTime' | 'stdTime', idx: number, val: string) => {
      const arr = [...(tc[field] || Array(5).fill(''))]
      arr[idx] = val
      setIso('timeCheck', { ...tc, [field]: arr })
    }
    return (
      <div className="card space-y-4">
        <h3 className="section-title">ตรวจสอบเวลา (Time Check)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-1 text-left">ครั้งที่</th>
                <th className="border border-gray-200 px-2 py-1">UUC Time (s)</th>
                <th className="border border-gray-200 px-2 py-1">STD Time (s)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="border border-gray-200 px-2 py-1 text-center font-medium">{i + 1}</td>
                  <td className="border border-gray-200 p-0.5">
                    <input type="number" step="any" className="w-full px-1 py-0.5 text-center outline-none"
                      value={tc.uucTime?.[i] || ''}
                      onChange={(e) => updateTimeCheck('uucTime', i, e.target.value)} />
                  </td>
                  <td className="border border-gray-200 p-0.5">
                    <input type="number" step="any" className="w-full px-1 py-0.5 text-center outline-none"
                      value={tc.stdTime?.[i] || ''}
                      onChange={(e) => updateTimeCheck('stdTime', i, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ---------- render ---------- */
  return (
    <form onSubmit={(e) => e.preventDefault()} onKeyDown={onFormKeyDown} className="space-y-6">
      {isReadOnly && (
        <div className="card border border-amber-300 bg-amber-50 text-amber-900">
          สิทธิ์ผู้ใช้ รพ. เป็นโหมดดูอย่างเดียว สามารถ Export PDF ได้ แต่ไม่สามารถแก้ไขข้อมูลสอบเทียบ
        </div>
      )}

      {/* Method badge */}
      <div className="card bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-3">
          <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-mono">{method.code}</span>
          <span className="font-medium text-blue-900">{method.nameTh} ({method.name})</span>
          <span className="text-sm text-blue-700">- {method.deviceType} [{method.unit}]</span>
        </div>
      </div>

      {/* ข้อมูลผู้สอบเทียบ */}
      {session?.user && (
        <div className="card border border-blue-200 bg-blue-50">
          <h3 className="section-title text-blue-900 mb-3">ข้อมูลผู้สอบเทียบ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">ชื่อ-สกุล (ไทย)</p>
              <p className="text-sm font-medium text-gray-900">
                {`${(session.user as any).rank || ''} ${(session.user as any).fullName || (session.user as any).name || ''}`.trim() || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">ชื่อ-สกุล (English)</p>
              <p className="text-sm font-medium text-gray-900">
                {`${(session.user as any).rankEn || ''} ${(session.user as any).fullNameEn || ''}`.trim() || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">เลขที่อาร์เมด (AmedNo.)</p>
              <p className="text-sm font-medium text-gray-900">{(session.user as any).amedNo || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">สิทธิ์</p>
              <p className="text-sm font-medium text-gray-900">
                {(session.user as any).role === 'admin' ? 'ผู้ดูแลระบบ'
                  : (session.user as any).role === 'technician' ? 'ช่างเทคนิค'
                  : (session.user as any).role === 'approver' ? 'ผู้อนุมัติ'
                  : 'ผู้ใช้ รพ.'}
              </p>
            </div>
            {(session.user as any).hospitalUnit && (
              <div>
                <p className="text-xs text-gray-500">หน่วยงาน</p>
                <p className="text-sm font-medium text-gray-900">{(session.user as any).hospitalUnit}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <fieldset disabled={isReadOnly} className="space-y-6">

        {/* Device info */}
        <div className="card space-y-4">
          <h3 className="section-title">ข้อมูลเครื่องมือ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { field: 'brand', label: 'ผู้ผลิต (Manufacturer)' },
              { field: 'model', label: 'รุ่น (Model)' },
              { field: 'serialNo', label: 'Serial No.' },
            ].map((f) => (
              <div key={f.field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <SuggestInput field={f.field} value={data[f.field] || ''} onChange={(v) => set(f.field, v)} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
              <input type="text" className="input-field"
                value={isoData.idNumber || ''}
                onChange={(e) => setIso('idNumber', e.target.value)} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${fieldErrors.deviceName ? 'text-red-600' : 'text-gray-700'}`}>ชื่อเครื่องมือ (Device)</label>
              <input type="text"
                className={fieldErrors.deviceName ? 'input-field bg-gray-50 border-red-500 ring-1 ring-red-500' : 'input-field bg-gray-50'}
                value={data.deviceName || method.deviceType}
                onChange={(e) => set('deviceName', e.target.value)} />
              {fieldErrors.deviceName && <p className="text-xs text-red-500 mt-1">{fieldErrors.deviceName}</p>}
            </div>
          </div>
        </div>

        {/* Calibration info */}
        <div className="card space-y-4">
          <h3 className="section-title">ข้อมูลการสอบเทียบ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่รับ (Received No.)</label>
              <input type="text" className="input-field"
                value={isoData.receivedNumber || ''}
                onChange={(e) => setIso('receivedNumber', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่ใบรับรอง (Certificate No.)</label>
              <input type="text" className="input-field"
                value={isoData.certificateNo || ''}
                onChange={(e) => setIso('certificateNo', e.target.value)} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1 ${fieldErrors.calDate ? 'text-red-600' : 'text-gray-700'}`}>วันที่สอบเทียบ</label>
              <input type="date"
                className={fieldErrors.calDate ? 'input-field border-red-500 ring-1 ring-red-500' : 'input-field'}
                value={data.calDate || ''}
                onChange={(e) => set('calDate', e.target.value)} />
              {fieldErrors.calDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.calDate}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่สอบเทียบ</label>
              <select className="input-field"
                value={isoData.calibrationPlace || 'onsite'}
                onChange={(e) => setIso('calibrationPlace', e.target.value)}>
                <option value="onsite">Onsite (ออกสถานที่)</option>
                <option value="laboratory">Laboratory (ห้องปฏิบัติการ)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สภาพเครื่อง (Condition)</label>
              <input type="text" className="input-field"
                value={isoData.condition || ''}
                onChange={(e) => setIso('condition', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference Standard</label>
              <select className="input-field"
                value={isoData.referenceStandard || ''}
                onChange={(e) => setIso('referenceStandard', e.target.value)}>
                <option value="">-- เลือก --</option>
                {method.referenceStandards.map((rs) => (
                  <option key={rs} value={rs}>{rs}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม (Start)</label>
              <input type="time" className="input-field"
                value={isoData.startTime || ''}
                onChange={(e) => setIso('startTime', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด (End)</label>
              <input type="time" className="input-field"
                value={isoData.endTime || ''}
                onChange={(e) => setIso('endTime', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UUC Resolution</label>
              <input type="number" step="any" className="input-field"
                value={isoData.uucResolution || ''}
                onChange={(e) => setIso('uucResolution', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Common fields */}
        <div className="card space-y-4">
          <h3 className="section-title">ข้อมูลหน่วยงาน / สภาพแวดล้อม</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={`block text-sm font-medium mb-1 ${fieldErrors.unitName ? 'text-red-600' : 'text-gray-700'}`}>ชื่อหน่วยงาน</label>
              <SuggestInput field="unitName"
                className={fieldErrors.unitName ? 'input-field border-red-500 ring-1 ring-red-500' : 'input-field'}
                value={data.unitName || ''}
                onChange={handleUnitNameChange}
                extraOptions={unitNameExtraOptions}
                restrictToList />
              {fieldErrors.unitName && <p className="text-xs text-red-500 mt-1">{fieldErrors.unitName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">แผนก / ห้อง</label>
              <SuggestInput field="section"
                value={data.section || ''}
                onChange={(v) => set('section', v)}
                placeholder="พิมพ์เพื่อค้นหาแผนก"
                extraOptions={SECTIONS}
                restrictToList />
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
              {addressFromRef ? (
                <input type="text" className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                  value={data.address || ''} readOnly />
              ) : (
                <SuggestInput field="address"
                  value={data.address || ''}
                  onChange={(v) => set('address', v)} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่ (Location)</label>
              {data.unitName?.trim() ? (
                <input type="text" className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                  value={data.location || ''} readOnly />
              ) : (
                <SuggestInput field="location"
                  value={data.location || ''}
                  onChange={(v) => set('location', normalizeHospitalUnitFromRefs(v, unitRefs))}
                  extraOptions={unitNameExtraOptions}
                  restrictToList />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อุณหภูมิห้อง (deg C)</label>
              <input type="number" step="any" className="input-field"
                value={data.lapTemp || ''}
                onChange={(e) => set('lapTemp', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ความชื้น (%RH)</label>
              <input type="number" step="any" className="input-field"
                value={data.lapHumid || ''}
                onChange={(e) => set('lapHumid', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้สอบเทียบ</label>
              <input type="text" className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                value={data.calibrate || ''} readOnly />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเครื่อง</label>
              <input type="date" className="input-field"
                value={data.receivedDate || ''}
                onChange={(e) => set('receivedDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับเครื่อง</label>
              <SuggestInput field="receivedN"
                value={data.receivedN || ''}
                onChange={(v) => set('receivedN', v)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ออกใบเซอร์</label>
              <input type="date" className="input-field"
                value={data.issuedDate || ''}
                onChange={(e) => set('issuedDate', e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">ถ้าไม่ระบุ ระบบจะใช้วันที่อนุมัติแทน</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ราคาสอบเทียบ (บาท)</label>
              <input type="number" className="input-field"
                value={data.calPrice || ''}
                onChange={(e) => set('calPrice', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ราคาปบ. (บาท)</label>
              <input type="number" className="input-field"
                value={data.mainPrice || ''}
                onChange={(e) => set('mainPrice', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Method-specific fields */}
        {method.formFields.length > 0 && (
          <div className="card space-y-4">
            <h3 className="section-title">ข้อมูลเฉพาะวิธี ({method.name})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {method.formFields.map((ff) => (
                <div key={ff.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{ff.labelTh} ({ff.label})</label>
                  {ff.type === 'select' ? (
                    <select className="input-field"
                      value={isoData[ff.key] || ''}
                      onChange={(e) => setIso(ff.key, e.target.value)}>
                      <option value="">-- เลือก --</option>
                      {(ff.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input type={ff.type} step={ff.type === 'number' ? 'any' : undefined}
                      className="input-field"
                      value={isoData[ff.key] || ''}
                      onChange={(e) => setIso(ff.key, e.target.value)} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Standard instrument (Std1) - for uncertainty calculation */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title">เครื่องมือมาตรฐาน (Standard Instrument)</h3>
            {std1FromRef && (
              <button type="button" onClick={clearStd1Ref}
                className="text-xs text-red-500 hover:text-red-700">ล้างข้อมูลอ้างอิง</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs mb-1 ${fieldErrors['std1.no'] ? 'text-red-600 font-medium' : 'text-gray-500'}`}>รหัส (No.)</label>
              {std1FromRef ? (
                <input type="text" className="input-field bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  value={data.std1?.no || ''} readOnly />
              ) : (
                <SuggestInput field="std1.no"
                  className={fieldErrors['std1.no'] ? 'input-field text-sm border-red-500 ring-1 ring-red-500' : 'input-field text-sm'}
                  value={data.std1?.no || ''}
                  onChange={(v) => { setStd1('no', v); if (v.trim()) setFieldErrors((p) => { const n = { ...p }; delete n['std1.no']; return n }) }}
                  onBlur={tryApplyStd1FromRef}
                  extraOptions={std1FieldOptions.no || []} />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อ (Name)</label>
              {std1FromRef ? (
                <input type="text" className="input-field bg-gray-100 text-gray-500 cursor-not-allowed text-sm"
                  value={data.std1?.name || ''} readOnly />
              ) : (
                <SuggestInput field="std1.name"
                  className="input-field text-sm"
                  value={data.std1?.name || ''}
                  onChange={(v) => setStd1('name', v)}
                  onBlur={tryApplyStd1FromRef}
                  extraOptions={std1FieldOptions.name || []} />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cert No.</label>
              <input type="text" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.certNo || ''}
                onChange={(e) => setStd1('certNo', e.target.value)}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Measurement</label>
              <input type="text" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.measurement || ''}
                onChange={(e) => setStd1('measurement', e.target.value)}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Unit</label>
              <input type="text" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.unit || ''}
                onChange={(e) => setStd1('unit', e.target.value)}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cal. Date</label>
              <input type="text" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.calDate || ''}
                onChange={(e) => setStd1('calDate', e.target.value)}
                readOnly={std1FromRef} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Correction</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.correction ?? ''}
                onChange={(e) => setStd1('correction', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">uT STD</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.uTStd ?? ''}
                onChange={(e) => setStd1('uTStd', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">uT Drif</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.uTDrif ?? ''}
                onChange={(e) => setStd1('uTDrif', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">uT Res.(STD)</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.uTResStd ?? ''}
                onChange={(e) => setStd1('uTResStd', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">uT Res.(UUC)</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.uTUuc ?? ''}
                onChange={(e) => setStd1('uTUuc', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">uT Int.</label>
              <input type="number" step="any" className={`input-field text-sm ${std1FromRef ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                value={data.std1?.uTInt ?? ''}
                onChange={(e) => setStd1('uTInt', e.target.value === '' ? '' : Number(e.target.value))}
                readOnly={std1FromRef} />
            </div>
          </div>
        </div>

        {/* Calibration readings */}
        <div className="card space-y-4">
          <h3 className="section-title">ข้อมูลจุดสอบเทียบ (Calibration Readings)</h3>
          <p className="text-xs text-gray-500 -mt-1">
            {method.measurementType === 'speed'
              ? `กรอกจุด Cal. Point แล้วค่า STD จะคำนวณอัตโนมัติจาก Cal.Point + Correction - กรอก UUC เอง`
              : method.measurementType === 'temperature_multi_sensor'
                ? `กรอกค่า ${method.sensorCount} Sensor x ${method.readingsPerPoint} readings ต่อจุด`
                : `กรอก UUC ${method.readingsPerPoint} ครั้งต่อจุด - STD คำนวณจาก Cal.Point + Correction`
            }
          </p>
          {renderCalibrationReadings()}
        </div>

        {/* Time check */}
        {renderTimeCheck()}

        {/* Remarks */}
        <div className="card space-y-3">
          <h3 className="section-title">หมายเหตุ</h3>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <label className="block text-xs text-gray-500 mb-1">หมายเหตุ {i + 1}</label>
              <input type="text" className="input-field"
                value={data.remarks?.[i] || ''}
                onChange={(e) => {
                  const arr = [...(data.remarks || ['', '', '', ''])]
                  arr[i] = e.target.value
                  set('remarks', arr)
                }} />
            </div>
          ))}
        </div>

      </fieldset>

      {/* Calculation validation errors */}
      {Object.keys(fieldErrors).some(k => k.includes('.') || k === 'iso.readings' || k === 'iso.point') && (
        <div className="card border-2 border-red-300 bg-red-50 text-red-700 space-y-1">
          <p className="font-semibold text-sm">ข้อมูลไม่เพียงพอสำหรับการคำนวณ:</p>
          {Object.entries(fieldErrors)
            .filter(([k]) => k.includes('.') || k === 'iso.readings' || k === 'iso.point')
            .map(([k, v]) => (
              <p key={k} className="text-sm">• {v}</p>
            ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="card bg-gray-50 border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary text-sm">ยกเลิก</button>
          {!isReadOnly && (
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={() => submit('draft')}
                className="btn-secondary px-5">
                {saving && !pendingContinueRef.current ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              {mode === 'edit' && (
                <button type="button" disabled={saving}
                  onClick={() => { pendingContinueRef.current = true; submit('draft') }}
                  className="btn-primary px-6 flex items-center gap-1.5">
                  {saving && pendingContinueRef.current ? 'กำลังบันทึก...' : <>บันทึกและไปต่อ <span>&rarr;</span></>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
