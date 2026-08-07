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
  const [section,    setSection]    = useState('')
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,      setTotal]      = useState(0)
  const cardFilterLabel: { [key: string]: string } = {
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
    if (search)  params.set('search', search)
    if (section) params.set('section', section)
    if (cardFilter) params.set('cardFilter', cardFilter)
    const res  = await fetch(`/api/records?${params}`)
    const data = await res.json()
    setRecords(data.records || [])
    setTotalPages(data.totalPages || 1)
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, section, page, cardFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])
  useEffect(() => { setPage(1) }, [cardFilter])

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
            <span>➕</span> เพิ่มข้อมูล
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="🔍  ค้นหา: ชื่อเครื่อง, เลขที่อาร์เมด, เลขที่ใบรับรอง..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input-field"
          />
          <input
            type="text"
            placeholder="🏥  กรองตามแผนก..."
            value={section}
            onChange={e => { setSection(e.target.value); setPage(1) }}
            className="input-field"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white">
              <tr>
                <th className="text-left py-3 px-4 font-medium">เลขที่อาร์เมด</th>
                <th className="text-left py-3 px-4 font-medium">เครื่องมือ</th>
                <th className="text-left py-3 px-4 font-medium hidden md:table-cell">โรงพยาบาล</th>
                <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">เลขที่ใบรับรอง</th>
                <th className="text-left py-3 px-4 font-medium hidden lg:table-cell">วันที่สอบเทียบ</th>
                <th className="text-center py-3 px-4 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">ไม่พบข้อมูล</td></tr>
              ) : records.map((r, i) => (
                <tr key={r._id} className={`border-b border-gray-50 hover:bg-military-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <td className="py-3 px-4 font-medium text-military-700">{r.amedNo || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-800">{r.deviceName || '-'}</div>
                    <div className="text-xs text-gray-400">{r.brand} {r.model}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 hidden md:table-cell">{r.unitName || '-'}</td>
                  <td className="py-3 px-4 text-gray-600 hidden lg:table-cell">{r.certNo || '-'}</td>
                  <td className="py-3 px-4 text-gray-600 hidden lg:table-cell">
                    {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
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
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">← ก่อนหน้า</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">ถัดไป →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
