'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'


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
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const cardFilter = String(searchParams.get('cardFilter') || '')
  const role = (session?.user as any)?.role
  const isAdmin = role === 'admin'
  const canAddRecord = role === 'admin' || role === 'technician'

  const [records,    setRecords]    = useState<CalibrationRecordRow[]>([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,      setTotal]      = useState(0)
  const [showFilter, setShowFilter] = useState(false)
  const [myOnly,     setMyOnly]     = useState(true)
  const [myOnlyInit, setMyOnlyInit] = useState(false)

  // Advanced filters
  const [fStatus,      setFStatus]      = useState('')
  const [fCalType,     setFCalType]     = useState('')
  const [fSection,     setFSection]     = useState('')
  const [fUnitName,    setFUnitName]    = useState('')
  const [fCalDateFrom, setFCalDateFrom] = useState('')
  const [fCalDateTo,   setFCalDateTo]   = useState('')

  const hasActiveFilter = !!(fStatus || fCalType || fSection || fUnitName || fCalDateFrom || fCalDateTo)
  const activeFilterCount = [fStatus, fCalType, fSection, fUnitName, fCalDateFrom, fCalDateTo].filter(Boolean).length

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
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search)       params.set('search', search)
    if (fSection)     params.set('section', fSection)
    if (fStatus)      params.set('status', fStatus)
    if (fCalType)     params.set('calType', fCalType)
    if (fUnitName)    params.set('unitName', fUnitName)
    if (fCalDateFrom) params.set('calDateFrom', fCalDateFrom)
    if (fCalDateTo)   params.set('calDateTo', fCalDateTo)
    if (cardFilter)   params.set('cardFilter', cardFilter)
    if (myOnly)       params.set('myOnly', '1')
    const res  = await fetch(`/api/records?${params}`)
    const data = await res.json()
    setRecords(data.records || [])
    setTotalPages(data.totalPages || 1)
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, fSection, fStatus, fCalType, fUnitName, fCalDateFrom, fCalDateTo, page, cardFilter, myOnly])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { setPage(1) }, [cardFilter])
  useEffect(() => {
    if (role && !myOnlyInit) {
      setMyOnly(!isAdmin)
      setMyOnlyInit(true)
    }
  }, [role, isAdmin, myOnlyInit])

  const clearFilters = () => {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-military-900">ข้อมูลสอบเทียบ</h1>
          <p className="text-gray-500 text-sm">{total} รายการ</p>
        </div>
        {canAddRecord && (
          <Link href="/records/new" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
            <span>+</span> เพิ่มข้อมูล
          </Link>
        )}
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
        <div className="flex items-center gap-4 mb-3">
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
        </div>

        {/* Search + toggle */}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="ค้นหา: ชื่อเครื่อง, เลขที่อาร์เมด, เลขที่ใบรับรอง, Serial No..."
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">โรงพยาบาล</label>
                <input type="text" className="input-field text-sm" placeholder="เช่น กรมแพทย์"
                  value={fUnitName} onChange={e => { setFUnitName(e.target.value); setPage(1) }} />
              </div>
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
            <thead className="bg-military-800 text-white">
              <tr>
                <th className="text-left py-3 px-3 font-medium">ประเภท</th>
                <th className="text-left py-3 px-3 font-medium">เลขที่อาร์เมด</th>
                <th className="text-left py-3 px-3 font-medium">เครื่องมือ</th>
                <th className="text-left py-3 px-3 font-medium hidden md:table-cell">โรงพยาบาล</th>
                <th className="text-left py-3 px-3 font-medium hidden xl:table-cell">แผนก</th>
                <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">ใบรับรอง</th>
                <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">วันที่สอบเทียบ</th>
                <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">สร้างโดย</th>
                <th className="text-left py-3 px-3 font-medium hidden md:table-cell">สถานะ</th>
                <th className="text-left py-3 px-3 font-medium hidden xl:table-cell">อัพเดทล่าสุด</th>
                <th className="text-center py-3 px-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-12 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
              ) : records.map((r, i) => (
                <tr key={r._id} className={`border-b border-gray-50 hover:bg-military-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
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
                      <Link href={`/records/${r._id}`}
                        className="text-military-600 hover:text-military-800 font-medium text-xs px-2 py-1 rounded border border-military-200 hover:bg-military-50">
                        ดู / แก้ไข
                      </Link>
                      <Link href={`/records/${r._id}/pdf`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">
                        PDF
                      </Link>
                      {isAdmin && (
                        <button onClick={() => handleDelete(r._id)}
                          className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50">
                          ลบ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
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
