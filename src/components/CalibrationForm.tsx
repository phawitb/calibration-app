'use client'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { buildHospitalUnitOptions, normalizeHospitalUnitFromRefs } from '@/lib/hospitalUnit'
import { useStepNav } from '@/lib/stepNavContext'

interface Props {
  initialData?: any
  mode: 'create' | 'edit'
  id?: string
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
  if (!initialData) return initialData
  return {
    ...initialData,
    issuedDate: toDateInputValue(initialData.issuedDate),
    receivedDate: toDateInputValue(initialData.receivedDate),
    calDate: toDateInputValue(initialData.calDate),
  }
}

function toThaiDate(value: unknown): string {
  const iso = toDateInputValue(value)
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH')
}

function hasUcContent(uc: any): boolean {
  if (!uc || typeof uc !== 'object') return false
  const std = uc.std || {}
  const stdHasValue = Object.values(std).some((v) => {
    if (v == null) return false
    if (typeof v === 'number') return !Number.isNaN(v) && v !== 0
    return String(v).trim() !== ''
  })
  if (stdHasValue) return true
  const points = Array.isArray(uc.calPoints) ? uc.calPoints : []
  for (const p of points) {
    if (p == null || typeof p !== 'object') continue
    if (String((p as any).point ?? '').trim() !== '') return true
    const readings = Array.isArray((p as any).readings) ? (p as any).readings : []
    if (readings.some((x: any) => String(x ?? '').trim() !== '')) return true
    const standards = Array.isArray((p as any).standards) ? (p as any).standards : []
    if (standards.some((x: any) => String(x ?? '').trim() !== '')) return true
  }
  return false
}

const SECTIONS = [
  'Operating Room (OR)', 'Emergency Room (ER)', 'Out-patient Department (OPD)',
  'Intensive Care Unit (ICU)', 'Ward', 'Laboratory', 'Radiology', 'Other',
]

type StdRef = Record<string, any>
type StdFieldOptions = Record<string, string[]>
type FormulaOption = { _id: string; code: string; name: string; isActive: boolean }

function buildStdFromRef(ref: StdRef) {
  return {
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
  }
}

function inferPointCountFromStdNo(no: any): number {
  return String(no ?? '').trim().startsWith('4') ? 4 : 6
}

/** หลังเลือกจากฐานอ้างอิง: จุดว่าง — STD คำนวณตอนกรอก Cal.Point (point + correction) */
function calPointsFromRef(pointCount: number) {
  return Array.from({ length: pointCount }, () => ({
    point: '',
    readings: ['', '', '', ''] as (number | string)[],
    standards: ['', '', '', ''] as (number | string)[],
  }))
}

const UC_STD_TEXT_FIELDS = [
  'no', 'name', 'manufacture', 'model', 'serialNo', 'certNo', 'measurement', 'unit', 'calDate',
] as const

function UcSection({
  label,
  value,
  onChange,
  stdRefs = [],
  stdFieldOptions,
  formulaOptions = [],
}: {
  label: string
  value: any
  onChange: (v: any) => void
  stdRefs?: StdRef[]
  stdFieldOptions?: StdFieldOptions
  formulaOptions?: FormulaOption[]
}) {
  const uc = value || {}
  const updateStd = (field: string, val: any) =>
    onChange({ ...uc, std: { ...(uc.std || {}), [field]: val } })
  const updatePoint = (idx: number, field: string, val: any) => {
    const emptyRow = { point: '', readings: ['', '', '', ''], standards: ['', '', '', ''] as (number | string)[] }
    const pts = [...(uc.calPoints || [emptyRow])]
    while (pts.length <= idx) pts.push({ ...emptyRow })
    const prev = { ...emptyRow, ...pts[idx] }
    if (field === 'point') {
      const raw = val === '' || val == null ? '' : String(val)
      const p = raw === '' ? NaN : parseFloat(raw)
      const corrRaw = uc.std?.correction
      const c =
        corrRaw != null && corrRaw !== ''
          ? parseFloat(String(corrRaw))
          : 0
      const co = Number.isNaN(c) ? 0 : c
      const stds: (number | string)[] =
        raw === '' || Number.isNaN(p) ? ['', '', '', ''] : [p + co, p + co, p + co, p + co]
      pts[idx] = { ...prev, point: raw, standards: stds }
    } else if (field === 'readings') {
      pts[idx] = { ...prev, readings: val }
    } else if (field === 'standards') {
      pts[idx] = { ...prev, standards: val }
    } else {
      pts[idx] = { ...prev, [field]: val }
    }
    onChange({ ...uc, calPoints: pts })
  }

  const tryApplyFromReference = () => {
    if (!stdRefs.length) return
    const n = (uc.std?.no ?? '').toString().trim()
    const na = (uc.std?.name ?? '').toString().trim()
    if (!n && !na) return
    const ref =
      (n && stdRefs.find((r) => (r?.no ?? '').toString().trim() === n)) ||
      (na && stdRefs.find((r) => (r?.name ?? '').toString().trim() === na)) ||
      null
    if (!ref) return
    const std = buildStdFromRef(ref)
    const pointCount = std.no != null && String(std.no).trim() ? inferPointCountFromStdNo(std.no) : 4
    const calPoints = calPointsFromRef(pointCount)
    onChange({ ...uc, std, calPoints })
  }

  const applyUcFromRef = (ref: StdRef) => {
    const std = buildStdFromRef(ref)
    const pointCount = std.no != null && String(std.no).trim() ? inferPointCountFromStdNo(std.no) : 4
    onChange({ ...uc, std, calPoints: calPointsFromRef(pointCount) })
  }

  const localStdFieldOptions = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const k of UC_STD_TEXT_FIELDS) {
      m[k] = Array.from(
        new Set(stdRefs.map((r) => String((r as any)?.[k] ?? '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'th'))
    }
    const corr = stdRefs
      .map((r) => r?.correction)
      .filter((c) => c != null && c !== '' && !Number.isNaN(Number(c)))
      .map((c) => String(Number(c)))
    m.correction = Array.from(new Set(corr)).sort((a, b) => Number(a) - Number(b))
    return m
  }, [stdRefs])
  const resolvedStdFieldOptions = stdFieldOptions || localStdFieldOptions

  const pointCount = uc.std?.no
    ? parseInt(String(uc.std.no).startsWith('4') ? '4' : '6', 10) || 4
    : 4

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <h4 className="font-medium text-military-700 text-sm">{label}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">สูตรการคำนวณ</label>
          <select
            className="input-field text-sm py-1.5"
            value={String(uc?.formulaId || 'standard')}
            onChange={(e) =>
              onChange({
                ...uc,
                formulaId: e.target.value === 'standard' ? null : e.target.value,
                formulaCode:
                  e.target.value === 'standard'
                    ? 'standard'
                    : (formulaOptions.find((f) => f._id === e.target.value)?.code || 'standard'),
              })
            }
          >
            <option value="standard">สูตรมาตรฐาน (95.45%) - ค่าเริ่มต้น</option>
            {formulaOptions
              .filter((f) => f.isActive && f.code !== 'standard')
              .map((f) => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
          </select>
        </div>
      </div>

      {/* Std instrument info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { field: 'no', label: 'รหัสเครื่องมือ', num: false },
          { field: 'name', label: 'ชื่อเครื่องมือ', num: false },
          { field: 'manufacture', label: 'ผู้ผลิต', num: false },
          { field: 'model', label: 'รุ่น', num: false },
          { field: 'serialNo', label: 'Serial No.', num: false },
          { field: 'certNo', label: 'Cert. No.', num: false },
          { field: 'measurement', label: 'ประเภทการวัด', num: false },
          { field: 'unit', label: 'หน่วย', num: false },
          { field: 'calDate', label: 'วันที่สอบเทียบ', num: false },
          { field: 'correction', label: 'Correction (ใช้คำนวณ STD)', num: true },
        ].map((f) => (
          <div key={f.field}>
            <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
            {f.num ? (
              <FilteredOptionsInput
                className="input-field text-xs py-1.5"
                num
                value={uc.std?.[f.field] != null && uc.std[f.field] !== '' ? uc.std[f.field] : ''}
                onChange={(v) =>
                  updateStd(f.field, v !== '' && v != null ? Number(v) : undefined)
                }
                options={resolvedStdFieldOptions.correction}
              />
            ) : (
              <FilteredOptionsInput
                className="input-field text-xs py-1.5"
                value={uc.std?.[f.field] ?? ''}
                onChange={(v) => updateStd(f.field, v)}
                options={resolvedStdFieldOptions[f.field] || []}
                onSelect={
                  f.field === 'no'
                    ? (v) => {
                        const r = stdRefs.find((s) => (s?.no ?? '').toString().trim() === v.trim())
                        if (r) applyUcFromRef(r)
                        else updateStd('no', v)
                      }
                    : f.field === 'name'
                      ? (v) => {
                          const r = stdRefs.find((s) => (s?.name ?? '').toString().trim() === v.trim())
                          if (r) applyUcFromRef(r)
                          else updateStd('name', v)
                        }
                      : undefined
                }
                onBlur={f.field === 'no' || f.field === 'name' ? tryApplyFromReference : undefined}
              />
            )}
          </div>
        ))}
      </div>

      {/* Cal points */}
      <div>
        <p className="text-xs text-gray-500 mb-2">จุดสอบเทียบ (Cal Points)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-1 text-left">จุดที่</th>
                <th className="border border-gray-200 px-2 py-1">Cal. Point</th>
                <th className="border border-gray-200 px-2 py-1">UUC 1</th>
                <th className="border border-gray-200 px-2 py-1">UUC 2</th>
                <th className="border border-gray-200 px-2 py-1">UUC 3</th>
                <th className="border border-gray-200 px-2 py-1">UUC 4</th>
                <th className="border border-gray-200 px-2 py-1">STD 1</th>
                <th className="border border-gray-200 px-2 py-1">STD 2</th>
                <th className="border border-gray-200 px-2 py-1">STD 3</th>
                <th className="border border-gray-200 px-2 py-1">STD 4</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: pointCount }).map((_, i) => {
                const pt = uc.calPoints?.[i] || {}
                return (
                  <tr key={i}>
                    <td className="border border-gray-200 px-2 py-1 text-center font-medium">{i + 1}</td>
                    <td className="border border-gray-200 p-0.5">
                      <input type="number" className="w-full px-1 py-0.5 text-center outline-none"
                        value={pt.point || ''} onChange={e => updatePoint(i, 'point', e.target.value)} />
                    </td>
                    {[0, 1, 2, 3].map(r => (
                      <td key={r} className="border border-gray-200 p-0.5">
                        <input type="number" className="w-full px-1 py-0.5 text-center outline-none"
                          value={pt.readings?.[r] || ''}
                          onChange={e => {
                            const arr = [...(pt.readings || [])]
                            arr[r] = Number(e.target.value)
                            updatePoint(i, 'readings', arr)
                          }} />
                      </td>
                    ))}
                    {[0, 1, 2, 3].map(s => (
                      <td key={s} className="border border-gray-200 p-0.5">
                        <input type="number" className="w-full px-1 py-0.5 text-center outline-none"
                          value={pt.standards?.[s] || ''}
                          onChange={e => {
                            const arr = [...(pt.standards || [])]
                            arr[s] = Number(e.target.value)
                            updatePoint(i, 'standards', arr)
                          }} />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/** คลิกรายการในดรอปดาวน์ = อัปเดตทันที ไม่ต้องออกโฟกัส — รายการ derived จากฐานอ้างอิง */
function FilteredOptionsInput({
  value,
  onChange,
  className = 'input-field',
  placeholder,
  options,
  type = 'text',
  step,
  onSelect,
  onBlur,
  maxVisible = 40,
  num = false,
}: {
  value: string | number | undefined
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  options: string[]
  type?: 'text' | 'number' | 'search'
  step?: string
  /** เรียกเมื่อคลิก/Enter เลือกรายการ — รับผิดชอบอัปเดต state เอง ถ้าไม่กำหนดใช้ onChange แทน */
  onSelect?: (value: string) => void
  onBlur?: () => void
  maxVisible?: number
  num?: boolean
}) {
  const [open, setOpen] = useState(false)
  const strVal = value === null || value === undefined ? '' : String(value)
  const filtered = useMemo(() => {
    if (!strVal.trim()) return options.slice(0, maxVisible)
    const q = strVal.toLowerCase()
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, maxVisible)
  }, [strVal, options, maxVisible])

  const showList = open && filtered.length > 0

  return (
    <div className="relative">
      <input
        type={num ? 'number' : type}
        step={num ? (step || 'any') : undefined}
        className={className}
        placeholder={placeholder}
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          onBlur?.()
          setTimeout(() => setOpen(false), 180)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && filtered.length) {
            e.preventDefault()
            e.stopPropagation()
            const pick = filtered[0]
            if (onSelect) onSelect(pick)
            else onChange(pick)
            setOpen(false)
            return
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        autoComplete="off"
      />
      {showList && (
        <ul
          className="absolute z-30 mt-0.5 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-left text-sm shadow-md"
          role="listbox"
        >
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              className="cursor-pointer px-2 py-1.5 hover:bg-gray-100"
              onMouseDown={(e) => {
                e.preventDefault()
                if (onSelect) onSelect(opt)
                else onChange(num ? String(opt) : opt)
                setOpen(false)
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SuggestInput({
  field,
  value,
  onChange,
  className = 'input-field',
  placeholder,
  extraOptions = [],
  onBlur,
}: {
  field: string
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  extraOptions?: string[]
  onBlur?: () => void
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
        const params = new URLSearchParams({
          field,
          q: value || '',
          limit: '20',
        })
        const res = await fetch(`/api/records/suggestions?${params.toString()}`, { signal: controller.signal })
        if (!res.ok) return
        const json = await res.json()
        setOptions(Array.isArray(json.suggestions) ? json.suggestions : [])
      } catch {
        // Ignore transient network/cancel errors in suggestion requests
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
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
          onBlur?.()
          setTimeout(() => setOpen(false), 180)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && filtered.length) {
            e.preventDefault()
            e.stopPropagation()
            onChange(filtered[0])
            setOpen(false)
            return
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        autoComplete="off"
      />
      {showList && (
        <ul
          className="absolute z-30 mt-0.5 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-0.5 text-left text-sm shadow-md"
          role="listbox"
        >
          {filtered.map((opt) => (
            <li
              key={opt}
              role="option"
              className="cursor-pointer px-2 py-1.5 hover:bg-gray-100"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(opt)
                setOpen(false)
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CalibrationForm({ initialData, mode, id }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const { goToNext } = useStepNav()
  const role = (session?.user as any)?.role as string | undefined
  const canSubmitForApproval = role === 'admin' || role === 'technician'
  const isReadOnly = role === 'hospital_user'
  const [canRequestApprovalNow, setCanRequestApprovalNow] = useState(false)
  const [saving, setSaving] = useState(false)
  const pendingContinueRef = useRef(false)
  const [unitRefs, setUnitRefs] = useState<UnitRef[]>([])
  const [stdInstruments, setStdInstruments] = useState<StdRef[]>([])
  const [approvers, setApprovers] = useState<Array<{ _id: string; fullName?: string; name?: string; rank?: string; fullNameEn?: string; rankEn?: string; role?: string }>>([])
  const [formulaOptions, setFormulaOptions] = useState<FormulaOption[]>([])
  const [ucExpanded, setUcExpanded] = useState<Record<string, boolean>>({
    uc2: false,
    uc3: false,
    uc4: false,
    uc5: false,
    uc6: false,
    ucT: false,
  })
  const [data, setData] = useState(
    () =>
      normalizeInitialData(initialData) || {
    amedNo: '', certNo: '', sbNo: '', select: false,
    unitName: '', address: '', section: '', deviceName: '', brand: '', model: '', serialNo: '', hpNumber: '',
    issuedDate: '', receivedN: '', receivedDate: '', calDate: '', location: '',
    lapTemp: '', lapHumid: '', calibrate: '', approve: '', calPrice: '', mainPrice: '',
    approvalStatus: 'draft', requestedApproverId: '', requestedApproverName: '',
    std1: {}, uc1: {}, uc2: {}, uc3: {}, uc4: {}, uc5: {}, uc6: {}, ucT: {},
    remarks: ['', '', '', ''],
  }
  )

  const set = (field: string, value: any) => setData((d: any) => ({ ...d, [field]: value }))
  const setNested = (parent: string, field: string, value: any) =>
    setData((d: any) => ({ ...d, [parent]: { ...(d[parent] || {}), [field]: value } }))

  useEffect(() => {
    if (!initialData) return
    setData((prev: any) => ({ ...prev, ...normalizeInitialData(initialData) }))
  }, [initialData])

  useEffect(() => {
    setUcExpanded({
      uc2: hasUcContent(data.uc2),
      uc3: hasUcContent(data.uc3),
      uc4: hasUcContent(data.uc4),
      uc5: hasUcContent(data.uc5),
      uc6: hasUcContent(data.uc6),
      ucT: hasUcContent(data.ucT),
    })
    // Only initialize expand/collapse based on loaded record/create defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialData])

  useEffect(() => {
    let mounted = true
    const loadRef = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          fetch('/api/reference?type=units'),
          fetch('/api/reference?type=stdinstruments'),
        ])
        if (uRes.ok) {
          const uJson = await uRes.json()
          if (mounted) setUnitRefs(Array.isArray(uJson.data) ? uJson.data : [])
        }
        if (sRes.ok) {
          const sJson = await sRes.json()
          if (mounted) setStdInstruments(Array.isArray(sJson.data) ? sJson.data : [])
        }
      } catch {
        // Keep form usable when reference API fails
      }
    }
    loadRef()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadFormulas = async () => {
      try {
        const res = await fetch('/api/admin/formulas')
        if (!res.ok) return
        const json = await res.json()
        if (!mounted) return
        const options = Array.isArray(json.formulas)
          ? json.formulas.map((f: any) => ({
              _id: String(f._id || ''),
              code: String(f.code || ''),
              name: String(f.name || f.code || 'สูตร'),
              isActive: Boolean(f.isActive),
            }))
          : []
        setFormulaOptions(options)
      } catch {
        // fallback to standard formula only
      }
    }
    loadFormulas()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (mode !== 'create') return
    const user = session?.user as any
    if (!user) return
    setData((d: any) => {
      if (String(d.calibrate || '').trim()) return d
      const fullEn = String(user.fullNameEn || '').trim()
      const rankEn = String(user.rankEn || '').trim()
      const fullTh = String(user.fullName || user.name || '').trim()
      const rankTh = String(user.rank || '').trim()
      const display = fullEn ? `${rankEn ? `${rankEn} ` : ''}${fullEn}`.trim() : `${rankTh ? `${rankTh} ` : ''}${fullTh}`.trim()
      return { ...d, calibrate: display }
    })
  }, [session, mode])

  useEffect(() => {
    if (mode !== 'edit') return
    const allow = searchParams.get('justSaved') === '1'
    if (allow) setCanRequestApprovalNow(true)
  }, [mode, searchParams])

  useEffect(() => {
    let mounted = true
    const loadApprovers = async () => {
      try {
        const res = await fetch('/api/users/approvers')
        if (!res.ok) return
        const json = await res.json()
        if (mounted) setApprovers(Array.isArray(json.users) ? json.users : [])
      } catch {
        // Keep form usable when approver API fails
      }
    }
    loadApprovers()
    return () => {
      mounted = false
    }
  }, [])

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
      [u?.name, u?.thaiName, `${u?.name || ''}(${u?.thaiName || ''})`].some((v) => String(v || '').trim().toLowerCase() === normalized)
    )
    if (selected?.address) {
      set('address', String(selected.address))
    }
    set('location', normalizedLabel)
  }

  const std1TextFieldOptions = useMemo(() => {
    const keys = [
      'no', 'name', 'manufacture', 'model', 'serialNo', 'certNo', 'measurement', 'unit', 'calDate',
    ] as const
    const m: Record<string, string[]> = {}
    for (const k of keys) {
      m[k] = Array.from(
        new Set(stdInstruments.map((r) => String((r as any)?.[k] ?? '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'th'))
    }
    return m
  }, [stdInstruments])
  const ucStdFieldOptions = useMemo(() => {
    const m: StdFieldOptions = {}
    for (const k of UC_STD_TEXT_FIELDS) {
      m[k] = Array.from(
        new Set(stdInstruments.map((r) => String((r as any)?.[k] ?? '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'th'))
    }
    const corr = stdInstruments
      .map((r) => r?.correction)
      .filter((c) => c != null && c !== '' && !Number.isNaN(Number(c)))
      .map((c) => String(Number(c)))
    m.correction = Array.from(new Set(corr)).sort((a, b) => Number(a) - Number(b))
    return m
  }, [stdInstruments])

  const applyStd1FromRef = (ref: StdRef) => {
    setData((d: any) => ({
      ...d,
      std1: {
        ...buildStdFromRef(ref),
        tMin: d.std1?.tMin,
        tMax: d.std1?.tMax,
        hMin: d.std1?.hMin,
        hMax: d.std1?.hMax,
      },
    }))
  }

  /** หลุดโฟกัสที่ รหัส/ชื่อ ของ std1: เติมค่าจาก StdInstrumentRef ถ้าแมตช์ (เก็บ tMin–hMax เดิม) */
  const tryApplyStd1FromRef = () => {
    if (!stdInstruments.length) return
    setData((d: any) => {
      const s = d.std1 || {}
      const n = (s.no ?? '').toString().trim()
      const na = (s.name ?? '').toString().trim()
      if (!n && !na) return d
      const ref =
        (n && stdInstruments.find((r) => (r?.no ?? '').toString().trim() === n)) ||
        (na && stdInstruments.find((r) => (r?.name ?? '').toString().trim() === na)) ||
        null
      if (!ref) return d
      return {
        ...d,
        std1: {
          ...buildStdFromRef(ref),
          tMin: d.std1?.tMin,
          tMax: d.std1?.tMax,
          hMin: d.std1?.hMin,
          hMax: d.std1?.hMax,
        },
      }
    })
  }

  /** กด Enter ในช่องกรอกไม่ให้ submit ฟอร์ม — บันทึกได้เฉพาะปุ่มด้านล่าง */
  const onFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter') return
    const t = e.target
    if (!(t instanceof HTMLElement)) {
      e.preventDefault()
      return
    }
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
    const missing = REQUIRED_FIELDS.filter(f => !String(data[f.key] || '').trim())
    if (missing.length > 0) {
      toast.error(`กรุณากรอก: ${missing.map(f => f.label).join(', ')}`)
      return false
    }
    return true
  }

  const buildPayload = (saveAction: 'draft' | 'request_approval') => {
    const selectedApprover = approvers.find((a) => String(a._id) === String(data.requestedApproverId || ''))
    return {
      ...data,
      saveAction,
      requestedApproverName:
        saveAction === 'request_approval' && selectedApprover
          ? `${selectedApprover.rankEn || selectedApprover.rank || ''} ${selectedApprover.fullNameEn || selectedApprover.fullName || selectedApprover.name || ''}`.trim()
          : data.requestedApproverName || '',
    }
  }

  const submit = async (saveAction: 'draft' | 'request_approval') => {
    if (isReadOnly) {
      toast.error('สิทธิ์ผู้ใช้ รพ. ดูข้อมูลได้อย่างเดียว')
      return
    }
    if (!validateRequired()) {
      pendingContinueRef.current = false
      return
    }
    if (saveAction === 'request_approval' && canSubmitForApproval && !data.requestedApproverId) {
      toast.error('กรุณาเลือกผู้อนุมัติ')
      return
    }
    if (saveAction === 'request_approval' && mode === 'edit' && !canRequestApprovalNow) {
      toast.error('กรุณากดอัพเดทค่า ก่อน')
      return
    }
    setSaving(true)
    const payload = buildPayload(saveAction)
    const url = mode === 'create' ? '/api/records' : `/api/records/${id}`
    const method = mode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      if (saveAction === 'request_approval') {
        toast.success('ส่งขออนุมัติใบเซอร์แล้ว — รอผู้อนุมัติในแอป')
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

  return (
    <form onSubmit={(e) => e.preventDefault()} onKeyDown={onFormKeyDown} className="space-y-6">
      {isReadOnly && (
        <div className="card border border-amber-300 bg-amber-50 text-amber-900">
          สิทธิ์ผู้ใช้ รพ. เป็นโหมดดูอย่างเดียว สามารถ Export PDF ได้ แต่ไม่สามารถแก้ไขข้อมูลสอบเทียบ
        </div>
      )}
      <fieldset disabled={isReadOnly} className="space-y-6">
      {/* Device Information */}
      <div className="card space-y-4">
        <h3 className="section-title">ข้อมูลเครื่องมือ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { field: 'amedNo', label: 'เลขที่อาร์เมด (AmedNo.)' },
            { field: 'sbNo', label: 'SB No.' },
            { field: 'certNo', label: 'เลขที่ใบรับรอง' },
            { field: 'deviceName', label: 'ชื่อเครื่องมือ' },
            { field: 'brand', label: 'ยี่ห้อ' },
            { field: 'model', label: 'รุ่น' },
            { field: 'serialNo', label: 'Serial No.' },
            { field: 'hpNumber', label: 'HP Number' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              {f.field === 'certNo' ? (
                <>
                  <input
                    type="text"
                    className="input-field bg-gray-100 text-gray-500 cursor-not-allowed"
                    value={data[f.field] || '(ระบบรันเลขอัตโนมัติ)'}
                    readOnly
                  />
                  <p className="text-xs text-gray-500 mt-1">ระบบรันเลขใบรับรองอัตโนมัติ ไม่ต้องกรอกเอง</p>
                </>
              ) : (
                <SuggestInput field={f.field}
                  value={data[f.field] || ''}
                  onChange={v => set(f.field, v)} />
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              id="select-checkbox"
              checked={!!data.select}
              onChange={(e) => set('select', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="select-checkbox" className="text-sm font-medium text-gray-700">
              เลือกเพื่อยืนยันการดำเนินการ ให้ใช้งานเลข Amed นี้
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">แผนก / ห้อง</label>
            <SuggestInput
              field="section"
              value={data.section || ''}
              onChange={v => set('section', v)}
              placeholder="พิมพ์เพื่อค้นหาแผนก"
              extraOptions={SECTIONS}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยงาน</label>
            <SuggestInput field="unitName"
              value={data.unitName || ''}
              onChange={handleUnitNameChange}
              extraOptions={unitNameExtraOptions} />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่</label>
            <SuggestInput field="address"
              value={data.address || ''}
              onChange={v => set('address', v)} />
          </div>
        </div>
      </div>

      {/* Dates & calibration info */}
      <div className="card space-y-4">
        <h3 className="section-title">ข้อมูลการสอบเทียบ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { field: 'receivedDate', label: 'วันที่รับเครื่อง',   type: 'date' },
            { field: 'receivedN',    label: 'ผู้รับเครื่อง',       type: 'text' },
            { field: 'calDate',      label: 'วันที่สอบเทียบ',     type: 'date' },
            { field: 'location',     label: 'สถานที่สอบเทียบ',    type: 'text' },
            { field: 'lapTemp',      label: 'อุณหภูมิห้อง (°C)',  type: 'number' },
            { field: 'lapHumid',     label: 'ความชื้น (%RH)',     type: 'number' },
            { field: 'calibrate',    label: 'ผู้สอบเทียบ',        type: 'text' },
            { field: 'calPrice',     label: 'ราคาสอบเทียบ (บาท)', type: 'number' },
            { field: 'mainPrice',    label: 'ราคาปบ. (บาท)',      type: 'number' },
          ].map(f => (
            <div key={f.field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              {f.field === 'location' ? (
                <SuggestInput field={f.field}
                  value={data[f.field] || ''}
                  onChange={v => set(f.field, normalizeHospitalUnitFromRefs(v, unitRefs))}
                  extraOptions={unitNameExtraOptions} />
              ) : f.type === 'text' ? (
                <SuggestInput field={f.field}
                  value={data[f.field] || ''}
                  onChange={v => set(f.field, v)} />
              ) : (
                <input type={f.type} className="input-field"
                  value={data[f.field] || ''}
                  onChange={e => set(f.field, e.target.value)} />
              )}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ออกใบเซอร์</label>
            <input
              type="date"
              className="input-field"
              value={data.issuedDate || ''}
              onChange={(e) => set('issuedDate', e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">ถ้าไม่ระบุ ระบบจะใช้วันที่อนุมัติแทน</p>
          </div>

        </div>
      </div>

      {/* Environmental std instrument */}
      <div className="card space-y-4">
        <h3 className="section-title">เครื่องมือมาตรฐานสภาพแวดล้อม (Std1)</h3>
        <p className="text-xs text-gray-500 -mt-1">
          พิมพ์กรองแล้วคลิกเลือกจากรายการ — รหัส/ชื่อที่ตรงฐานอ้างอิงจะเติมฟิลด์ทันที (หรือออกจากช่องหลังพิมพ์)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['no','name','manufacture','model','serialNo','certNo','measurement','unit','calDate'].map(f => (
            <div key={f}>
              <label className="block text-xs text-gray-500 mb-1 capitalize">{f}</label>
              <FilteredOptionsInput
                className="input-field text-sm"
                value={data.std1?.[f] || ''}
                onChange={(v) => setNested('std1', f, v)}
                options={std1TextFieldOptions[f] || []}
                onSelect={
                  f === 'no' || f === 'name'
                    ? (v) => {
                        const ref =
                          f === 'no'
                            ? stdInstruments.find((r) => (r?.no ?? '').toString().trim() === v.trim())
                            : stdInstruments.find((r) => (r?.name ?? '').toString().trim() === v.trim())
                        if (ref) applyStd1FromRef(ref)
                        else setNested('std1', f, v)
                      }
                    : undefined
                }
                onBlur={f === 'no' || f === 'name' ? tryApplyStd1FromRef : undefined}
              />
            </div>
          ))}
          {['tMin','tMax','hMin','hMax'].map(f => (
            <div key={f}>
              <label className="block text-xs text-gray-500 mb-1">{f}</label>
              <input type="number" className="input-field text-sm"
                value={data.std1?.[f] || ''}
                onChange={e => setNested('std1', f, Number(e.target.value))} />
            </div>
          ))}
        </div>
      </div>

      {/* Uncertainty components */}
      <div className="card space-y-4">
        <h3 className="section-title">ข้อมูลการสอบเทียบ (Uncertainty Components)</h3>
        <p className="text-xs text-gray-500 -mt-1">
          รหัส/ชื่อเครื่อง: พิมพ์กรองแล้วคลิกเลือก — ดึงจากฐานอ้างอิงทันที — กรอก <span className="font-medium">Cal. Point</span> แต่ละแถว
          แล้วคอลัมน์ <span className="font-medium">STD 1–4</span> จะคำนวณอัตโนมัติ ตาม
          <span className="font-mono"> Cal.Point + (correction หรือ 0) </span>
          ทั้ง 4 ช่องเท่ากัน — แก้ STD เองทีหลังได้ — <span className="font-medium">UUC</span> กรอกเอง
        </p>
        <div className="space-y-4">
          <UcSection
            stdRefs={stdInstruments}
            stdFieldOptions={ucStdFieldOptions}
            formulaOptions={formulaOptions}
            label="เครื่องมือสอบเทียบ UC1"
            value={data.uc1}
            onChange={(v) => set('uc1', v)}
          />
          {(['uc2', 'uc3', 'uc4', 'uc5', 'uc6'] as const).map((uc) => (
            <div key={uc} className="border border-gray-200 rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-lg"
                onClick={() => setUcExpanded((prev) => ({ ...prev, [uc]: !prev[uc] }))}
              >
                <span className="font-medium text-military-700">เครื่องมือสอบเทียบ {uc.toUpperCase()}</span>
                <span className="text-sm text-gray-500">{ucExpanded[uc] ? 'ซ่อน' : 'แสดง'}</span>
              </button>
              {ucExpanded[uc] && (
                <div className="p-4 pt-0">
                  <UcSection
                    stdRefs={stdInstruments}
                    stdFieldOptions={ucStdFieldOptions}
                    formulaOptions={formulaOptions}
                    label={`เครื่องมือสอบเทียบ ${uc.toUpperCase()}`}
                    value={data[uc]}
                    onChange={(v) => set(uc, v)}
                  />
                </div>
              )}
            </div>
          ))}
          <div className="border border-gray-200 rounded-lg">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-lg"
              onClick={() => setUcExpanded((prev) => ({ ...prev, ucT: !prev.ucT }))}
            >
              <span className="font-medium text-military-700">เครื่องมือสอบเทียบเวลา (UcT)</span>
              <span className="text-sm text-gray-500">{ucExpanded.ucT ? 'ซ่อน' : 'แสดง'}</span>
            </button>
            {ucExpanded.ucT && (
              <div className="p-4 pt-0">
                <UcSection
                  stdRefs={stdInstruments}
                  stdFieldOptions={ucStdFieldOptions}
                  formulaOptions={formulaOptions}
                  label="เครื่องมือสอบเทียบเวลา (UcT)"
                  value={data.ucT}
                  onChange={(v) => set('ucT', v)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="card space-y-3">
        <h3 className="section-title">หมายเหตุ</h3>
        {[0,1,2,3].map(i => (
          <div key={i}>
            <label className="block text-xs text-gray-500 mb-1">หมายเหตุ {i+1}</label>
            <input type="text" className="input-field"
              value={data.remarks?.[i] || ''}
              onChange={e => {
                const arr = [...(data.remarks || ['','','',''])]
                arr[i] = e.target.value
                set('remarks', arr)
              }} />
          </div>
        ))}
      </div>

      {/* Approver (ส่งอนุมัติ) + actions */}
      {mode === 'edit' && canSubmitForApproval && (
        <div className="card space-y-2">
          <label className="block text-sm font-medium text-gray-700">ผู้อนุมัติ (เลือกก่อนกด “ขออนุมัติใบเซอร์”)</label>
          <select
            className="input-field"
            value={data.requestedApproverId || ''}
            onChange={(e) => set('requestedApproverId', e.target.value)}
          >
            <option value="">-- ยังไม่ระบุ --</option>
            {approvers.map((a) => (
              <option key={a._id} value={a._id}>
                {`${a.rankEn || a.rank || ''} ${a.fullNameEn || a.fullName || a.name || ''}`.trim()} ({a.role})
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            ปุ่มขออนุมัติจะกดได้หลัง “บันทึก” เท่านั้น
          </p>
        </div>
      )}
      </fieldset>

      <div className="card bg-gray-50 border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary text-sm">ยกเลิก</button>
          {!isReadOnly && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => submit('draft')}
                className="btn-secondary px-5"
              >
                {saving && !pendingContinueRef.current ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              {mode === 'edit' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { pendingContinueRef.current = true; submit('draft') }}
                  className="btn-primary px-6 flex items-center gap-1.5"
                >
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
