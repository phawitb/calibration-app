'use client'
import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { useTableSort } from '@/hooks/useTableSort'
import Link from 'next/link'
import RecordDownloadAll from '@/components/RecordDownloadAll'
import RecordStandardCertificates from '@/components/RecordStandardCertificates'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useHospitalWorkspace } from '@/components/HospitalWorkspace'
import SelectHospitalHint from '@/components/SelectHospitalHint'
import { displayHospitalName } from '@/lib/hospitalUnit'
import {
  isRecordRowActionTarget,
  loadPersonnelCertificateIntoPopup,
  nextExpandedRecordId,
  reserveDocumentPopup,
} from '@/lib/recordDocumentActions'


interface CalibrationRecordRow {
  _id: string
  recordNo: number
  amedNo: string
  certNo: string
  deviceName: string
  brand: string
  model: string
  serialNo: string
  unitName: string
  section: string
  calDate: string
  select: boolean
  lapTemp: number
  lapHumid: number
  calibrate: string
  approve: string
  calibratedById?: string
  approvedById?: string
  requestedApproverName?: string
  calPrice: number
  approvalStatus?: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  rejectionComment?: string
  updatedAt?: string
  calibrationType?: 'sbcal' | 'iso'
  isoMethodCode?: string
  createdBy?: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'pending_approval', label: 'รออนุมัติ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'rejected', label: 'ไม่อนุมัติ' },
]

const CALTYPE_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'sbcal', label: 'SbCal' },
  { value: 'iso', label: 'ISO' },
]

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    approved:         { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'อนุมัติแล้ว' },
    pending_approval: { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'รออนุมัติ' },
    rejected:         { bg: 'bg-red-100',      text: 'text-red-700',     label: 'ไม่อนุมัติ' },
    draft:            { bg: 'bg-gray-100',     text: 'text-gray-600',    label: 'ฉบับร่าง' },
  }
  const s = map[status || 'draft'] || map.draft
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default function RecordsPage() {
  const { data: session, status: sessionStatus } = useSession()
  const searchParams = useSearchParams()
  const { selectedHospital, loading: workspaceLoading } = useHospitalWorkspace()
  const cardFilter = String(searchParams.get('cardFilter') || '')
  const role = (session?.user as any)?.role
  const isAdmin = role === 'admin'
  const isHospitalUser = role === 'hospital_user'

  const [records,    setRecords]    = useState<CalibrationRecordRow[]>([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,      setTotal]      = useState(0)
  const [showFilter, setShowFilter] = useState(false)
  const [myOnly,     setMyOnly]     = useState(false)
  const [myOnlyInit, setMyOnlyInit] = useState(false)
  const requestVersion = useRef(0)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)

  // Advanced filters
  const [fStatus,      setFStatus]      = useState('')
  const [fCalType,     setFCalType]     = useState('')
  const [fSection,     setFSection]     = useState('')
  const [fUnitName,    setFUnitName]    = useState('')
  const [fCalYear, setFCalYear] = useState('')
  const [fCalDateFrom, setFCalDateFrom] = useState('')
  const [fCalDateTo,   setFCalDateTo]   = useState('')

  const { sorted: sortedRecords, sortKey, sortDir, toggle: toggleSort } = useTableSort(records, 'calDate', 'desc')

  const hasActiveFilter = !!(fStatus || fCalType || fSection || fCalYear || fCalDateFrom || fCalDateTo)
  const activeFilterCount = [fStatus, fCalType, fSection, fCalYear, fCalDateFrom, fCalDateTo].filter(Boolean).length

  const cardFilterLabel: Record<string, string> = {
    pending: 'รออนุมัติ',
    expiring: 'ใกล้ครบอายุสอบเทียบ',
    overdue: 'เกินกำหนดสอบเทียบใหม่',
    week: 'รายการสัปดาห์นี้',
    today: 'เพิ่มวันนี้',
    approved: 'อนุมัติแล้ว',
    draft: 'ฉบับร่าง',
  }

  const fetchRecords = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search)       params.set('search', search)
    if (fSection)     params.set('section', fSection)
    if (fStatus)      params.set('status', fStatus)
    if (fCalType)     params.set('calType', fCalType)
    if (selectedHospital) params.set('unitName', selectedHospital)
    if (isHospitalUser && /^\d{4}$/.test(fCalYear) && Number(fCalYear) >= 2443 && Number(fCalYear) <= 2843) params.set('calYear', fCalYear)
    if (fCalDateFrom) params.set('calDateFrom', fCalDateFrom)
    if (fCalDateTo)   params.set('calDateTo', fCalDateTo)
    if (cardFilter)   params.set('cardFilter', cardFilter)
    if (myOnly && !isHospitalUser) params.set('myOnly', '1')
    try {
      const res = await fetch(`/api/records?${params}`)
      if (!res.ok) throw new Error('โหลดประวัติสอบเทียบไม่สำเร็จ')
      const data = await res.json()
      if (version !== requestVersion.current) return
      setRecords(data.records || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch {
      if (version === requestVersion.current) toast.error('โหลดประวัติสอบเทียบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [isHospitalUser, fCalYear, search, fSection, fStatus, fCalType, fUnitName, fCalDateFrom, fCalDateTo, page, cardFilter, myOnly, selectedHospital])

  // Do not fetch with the temporary default before the role determines the initial scope.
  // Otherwise a late response for "งานของฉัน" can overwrite the approver's "ทั้งหมด" result.
  useEffect(() => {
    if (sessionStatus === 'loading' || !myOnlyInit || workspaceLoading) return
    if (!selectedHospital && role !== 'hospital_user') return
    fetchRecords()
    return () => { requestVersion.current += 1 }
  }, [fetchRecords, sessionStatus, myOnlyInit, workspaceLoading, selectedHospital, role])
  useEffect(() => { setPage(1) }, [cardFilter])
  useEffect(() => {
    if (role && !myOnlyInit) {
      setMyOnly(false)
      setMyOnlyInit(true)
    }
  }, [role, isAdmin, myOnlyInit])

  const clearFilters = () => {
    setFCalYear('')
    setFStatus(''); setFCalType(''); setFSection(''); setFUnitName('')
    setFCalDateFrom(''); setFCalDateTo('')
    setPage(1)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบข้อมูลนี้?')) return
    const res = await fetch(`/api/records/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('ลบข้อมูลสำเร็จ'); fetchRecords() }
    else toast.error('ไม่สามารถลบได้')
  }

  const openPersonnelCertificate = async (userId: string, roleLabel: string) => {
    const popup = reserveDocumentPopup((url, target) => window.open(url, target))
    if (!popup) {
      toast.error('เบราว์เซอร์บล็อกแท็บใหม่ กรุณาอนุญาตป๊อปอัปแล้วลองอีกครั้ง')
      return
    }

    const result = await loadPersonnelCertificateIntoPopup(userId, popup, url => fetch(url))
    if (result === 'missing') {
      toast.error(`${roleLabel}ยังไม่มีใบเซอร์`)
    } else if (result === 'failed') {
      toast.error(`ไม่สามารถโหลดใบเซอร์${roleLabel}ได้`)
    }
  }

  if (workspaceLoading || sessionStatus === 'loading') {
    return <p className="text-center text-gray-400 py-16">กำลังโหลด...</p>
  }

  if (!selectedHospital && role !== 'hospital_user') {
    return (
      <SelectHospitalHint
        title="เลือกโรงพยาบาลเพื่อดูประวัติสอบเทียบ"
        detail="แท็บนี้แสดงรายการสอบเทียบที่ผ่านมาของ รพ. ที่เลือก"
      />
    )
  }

  const hospitalTitle = selectedHospital ? (displayHospitalName(selectedHospital).title || selectedHospital) : ''

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-military-900">ประวัติสอบเทียบ</h1>
          <p className="text-gray-500 text-sm">{hospitalTitle ? `${hospitalTitle} — ` : ''}{total} รายการ</p>
        </div>
        <RecordDownloadAll records={sortedRecords} disabled={loading} />
      </div>

      {/* Search & Filter */}
      <div className="card">
        {cardFilter && (
          <div className="mb-3 text-sm text-military-800 flex items-center justify-between">
            <span>ตัวกรองจากแดชบอร์ด: <span className="font-semibold">{cardFilterLabel[cardFilter] || cardFilter}</span></span>
            <Link href="/records" className="text-military-600 hover:underline text-xs">ล้างตัวกรอง</Link>
          </div>
        )}

        {/* My records toggle */}
        {!isHospitalUser && <div className="flex items-center gap-4 mb-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="radio" name="myOnly" checked={myOnly} onChange={() => { setMyOnly(true); setPage(1) }}
              className="accent-military-700" />
            งานของฉัน
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="radio" name="myOnly" checked={!myOnly} onChange={() => { setMyOnly(false); setPage(1) }}
              className="accent-military-700" />
            ทั้งหมด
          </label>
        </div>}

        {/* Search + toggle */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="ค้นหา: ชื่อเครื่อง, เลขที่อาร์เมด, เลขที่ใบรับรอง, Serial No, วันที่สอบเทียบ เช่น 19/9/2569..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={() => setShowFilter(f => !f)}
            className={`btn-secondary text-xs whitespace-nowrap flex items-center gap-1.5 ${hasActiveFilter ? 'border-military-500 bg-military-50 text-military-800' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z" clipRule="evenodd" />
            </svg>
            ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-military-600 text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filters panel */}
        {showFilter && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">สถานะ</label>
                <select className="input-field text-sm" value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(1) }}>
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ประเภท</label>
                <select className="input-field text-sm" value={fCalType} onChange={e => { setFCalType(e.target.value); setPage(1) }}>
                  {CALTYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">แผนก</label>
                <input type="text" className="input-field text-sm" placeholder="เช่น Laboratory"
                  value={fSection} onChange={e => { setFSection(e.target.value); setPage(1) }} />
              </div>
              {isHospitalUser ? <div>
                <label className="block text-xs text-gray-500 mb-1" htmlFor="calibration-year-filter">ปีที่สอบเทียบ (พ.ศ.)</label>
                <input id="calibration-year-filter" type="text" inputMode="numeric" maxLength={4} placeholder="เช่น 2569" className="input-field text-sm"
                  value={fCalYear} onChange={e => { setFCalYear(e.target.value.replace(/[^0-9]/g, '')); setPage(1) }} />
              </div> : <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">วันที่สอบเทียบ ตั้งแต่</label>
                <input type="date" className="input-field text-sm"
                  value={fCalDateFrom} onChange={e => { setFCalDateFrom(e.target.value); setPage(1) }} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ถึงวันที่</label>
                <input type="date" className="input-field text-sm"
                  value={fCalDateTo} onChange={e => { setFCalDateTo(e.target.value); setPage(1) }} />
              </div>
              </>}
            </div>
            {hasActiveFilter && (
              <div className="flex justify-end">
                <button type="button" onClick={clearFilters}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline">
                  ล้างตัวกรองทั้งหมด
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white select-none">
              <tr>
                {[
                  ['calibrationType', 'ประเภท', ''],
                  ['amedNo', 'เลขที่อาร์เมด', ''],
                  ['deviceName', 'เครื่องมือ', ''],
                  ['unitName', 'โรงพยาบาล', 'hidden md:table-cell'],
                  ['section', 'แผนก', 'hidden xl:table-cell'],
                  ['certNo', 'ใบรับรอง', 'hidden lg:table-cell'],
                  ['calDate', 'วันที่สอบเทียบ', 'hidden lg:table-cell'],
                  ['createdBy', 'สร้างโดย', 'hidden lg:table-cell'],
                  ['approvalStatus', 'สถานะ', 'hidden md:table-cell'],
                  ['updatedAt', 'อัพเดทล่าสุด', 'hidden xl:table-cell'],
                ].map(([key, label, visibility]) => <th key={key}
                  aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`text-left p-0 font-medium ${visibility} ${sortKey === key ? 'bg-military-700' : ''}`}>
                  <button type="button" onClick={() => toggleSort(key)}
                    aria-label={`เรียงตาม${label}${sortKey === key && sortDir === 'asc' ? 'จากมากไปน้อย' : 'จากน้อยไปมาก'}`}
                    className="group flex w-full items-center gap-2 whitespace-nowrap px-3 py-4 text-left transition-colors hover:bg-military-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white">
                    <span>{label}</span>
                    <svg aria-hidden="true" className="h-4 w-3 shrink-0" viewBox="0 0 12 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 6 3-3 3 3" className={sortKey === key && sortDir === 'asc' ? 'text-white' : 'text-white/30 group-hover:text-white/60'} />
                      <path d="m3 10 3 3 3-3" className={sortKey === key && sortDir === 'desc' ? 'text-white' : 'text-white/30 group-hover:text-white/60'} />
                    </svg>
                  </button>
                </th>)}
                <th className="w-10 px-3 py-3"><span className="sr-only">รายละเอียด</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-12 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : sortedRecords.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
              ) : sortedRecords.map((r, i) => (
                <Fragment key={r._id}>
                  <tr
                    className={`border-b border-gray-50 hover:bg-military-50 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    onClick={(event) => {
                      if (isRecordRowActionTarget(event.target)) return
                      setExpandedRecordId(current => nextExpandedRecordId(current, r._id))
                    }}
                  >
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.calibrationType === 'iso' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {r.calibrationType === 'iso' ? 'ISO' : 'SbCal'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-military-700">{r.amedNo || '-'}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-gray-800">{r.deviceName || '-'}</div>
                      <div className="text-xs text-gray-400">{[r.brand, r.model].filter(Boolean).join(' ')}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600 hidden md:table-cell max-w-[180px] truncate">{r.unitName || '-'}</td>
                    <td className="py-3 px-3 text-gray-600 hidden xl:table-cell">{r.section || '-'}</td>
                    <td className="py-3 px-3 text-gray-600 hidden lg:table-cell">{r.certNo || '-'}</td>
                    <td className="py-3 px-3 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                      {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}
                    </td>
                    <td className="py-3 px-3 text-gray-600 text-xs hidden lg:table-cell">{r.createdBy || '-'}</td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <StatusBadge status={r.approvalStatus} />
                      {r.approvalStatus === 'rejected' && r.rejectionComment && (
                        <div className="text-xs text-red-500 mt-0.5 max-w-[160px] truncate" title={r.rejectionComment}>
                          {r.rejectionComment}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs hidden xl:table-cell whitespace-nowrap">
                      {r.updatedAt
                        ? new Date(r.updatedAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          aria-expanded={expandedRecordId === r._id}
                          aria-controls={`record-documents-${r._id}`}
                          aria-label={expandedRecordId === r._id ? 'ซ่อนเอกสารรายการสอบเทียบ' : 'แสดงเอกสารรายการสอบเทียบ'}
                          onClick={() => setExpandedRecordId(current => nextExpandedRecordId(current, r._id))}
                          className="rounded p-1 text-military-600 hover:bg-military-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-military-500"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                            className={`w-4 h-4 transition-transform ${expandedRecordId === r._id ? 'rotate-180' : ''}`}
                          >
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.1 1.02l-4.25 4.5a.75.75 0 01-1.1 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRecordId === r._id && (
                    <tr>
                      <td colSpan={11} className="bg-gray-50 border-b border-gray-200 p-0">
                        <div id={`record-documents-${r._id}`} className="px-6 py-4 space-y-3">
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                            <span>ผู้สอบเทียบ: {r.calibrate || '-'}</span>
                            {r.approvalStatus === 'pending_approval' ? (
                              <span>ผู้รับคำขออนุมัติ: {r.requestedApproverName || 'ไม่ระบุ'} (รออนุมัติ)</span>
                            ) : (
                              <span>ผู้อนุมัติ: {r.approve || '-'}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <a
                              href={`/records/${r._id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded border border-military-300 text-military-700 hover:bg-military-50 font-medium whitespace-nowrap"
                            >
                              ใบรับรอง
                            </a>
                            {(
                              <button
                                type="button"
                                disabled={!r.calibratedById}
                                title={!r.calibratedById ? 'รายการนี้ยังไม่ได้เชื่อมโยงบัญชีผู้สอบเทียบ' : 'เปิดใบเซอร์ผู้สอบเทียบ'}
                                onClick={() => r.calibratedById && openPersonnelCertificate(r.calibratedById, 'ผู้สอบเทียบ')}
                                className="disabled:opacity-50 disabled:cursor-not-allowed text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium whitespace-nowrap"
                              >
                                เซอร์ผู้สอบ
                              </button>
                            )}
                            {(
                              <button
                                type="button"
                                disabled={!r.approvedById}
                                title={!r.approvedById ? 'ยังไม่มีข้อมูลผู้อนุมัติของรายการนี้' : 'เปิดใบเซอร์ผู้อนุมัติ'}
                                onClick={() => r.approvedById && openPersonnelCertificate(r.approvedById, 'ผู้อนุมัติ')}
                                className="disabled:opacity-50 disabled:cursor-not-allowed text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 font-medium whitespace-nowrap"
                              >
                                เซอร์ผู้อนุมัติ
                              </button>
                            )}
                            <RecordStandardCertificates recordId={r._id} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
                        <Link href={`/records/${r._id}`}
                          className="text-military-600 hover:text-military-800 font-medium text-xs px-2 py-1 rounded border border-military-200 hover:bg-military-50">
                          ดู / แก้ไข
                        </Link>
                        {isAdmin && (
                          <button onClick={() => handleDelete(r._id)}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">
                            ลบ
                          </button>
                        )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">หน้า {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">&larr; ก่อนหน้า</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">ถัดไป &rarr;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
