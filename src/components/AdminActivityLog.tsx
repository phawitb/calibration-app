'use client'
import { useCallback, useEffect, useState } from 'react'

type ActivityItem = {
  _id: string
  username: string
  role?: string
  action: string
  targetType?: string
  targetId?: string
  detail?: string
  ip?: string
  userAgent?: string
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  login_success: 'เข้าสู่ระบบสำเร็จ',
  login_failure: 'เข้าสู่ระบบไม่สำเร็จ',
  logout: 'ออกจากระบบ',
  impersonate_start: 'เริ่มสวมสิทธิ์ผู้ใช้',
  impersonate_stop: 'เลิกสวมสิทธิ์ผู้ใช้',
  record_create: 'สร้างรายการสอบเทียบ',
  record_update: 'แก้ไขรายการสอบเทียบ',
  record_delete: 'ลบรายการสอบเทียบ',
  record_request_approval: 'ส่งขออนุมัติ',
  record_approve: 'อนุมัติใบรับรอง',
  record_reject: 'ไม่อนุมัติ/ตีกลับ',
  user_create: 'สร้างผู้ใช้',
  user_update: 'แก้ไขผู้ใช้',
  user_delete: 'ลบผู้ใช้',
  certificate_download: 'ดาวน์โหลดใบรับรอง',
  attachment_upload: 'แนบไฟล์ผลสอบเทียบ',
  attachment_delete: 'ลบไฟล์แนบ',
  pin_set: 'ตั้ง/เปลี่ยน PIN',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  approver: 'ผู้อนุมัติ',
  technician: 'จนท.สอบเทียบ',
  hospital_user: 'ผู้ใช้ รพ.',
}

function actionTone(action: string) {
  if (action === 'login_failure' || action.endsWith('_delete') || action === 'record_reject') return 'bg-red-50 text-red-700'
  if (action.startsWith('impersonate')) return 'bg-purple-50 text-purple-700'
  if (action === 'record_approve' || action === 'login_success') return 'bg-emerald-50 text-emerald-700'
  return 'bg-gray-100 text-gray-700'
}

export default function AdminActivityLog() {
  const [filters, setFilters] = useState({ username: '', action: '', from: '', to: '' })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [items, setItems] = useState<ActivityItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [actions, setActions] = useState<string[]>(Object.keys(ACTION_LABELS))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (applied.username) params.set('username', applied.username)
    if (applied.action) params.set('action', applied.action)
    if (applied.from) params.set('from', applied.from)
    if (applied.to) params.set('to', applied.to)
    params.set('page', String(page))
    params.set('limit', String(limit))
    try {
      const res = await fetch(`/api/admin/activity?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'โหลดประวัติไม่สำเร็จ')
      setItems(json.items || [])
      setTotal(Number(json.total || 0))
      setTotalPages(Number(json.totalPages || 1))
      if (Array.isArray(json.actions) && json.actions.length) setActions(json.actions)
    } catch (e: any) {
      setError(e?.message || 'โหลดประวัติไม่สำเร็จ')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [applied, page, limit])

  useEffect(() => { load() }, [load])

  const submitFilters = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setApplied(filters)
  }

  const resetFilters = () => {
    const empty = { username: '', action: '', from: '', to: '' }
    setFilters(empty)
    setApplied(empty)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="section-title">ประวัติการใช้งานระบบ</h2>
        <p className="text-sm text-gray-600 mb-3">บันทึกการเข้า-ออกระบบ การแก้ไขข้อมูล การอนุมัติ และการดาวน์โหลด เก็บย้อนหลัง 10 ปี</p>
        <form onSubmit={submitFilters} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm mb-1 text-gray-600">ชื่อผู้ใช้</label>
            <input className="input-field" value={filters.username} onChange={(e) => setFilters((f) => ({ ...f, username: e.target.value }))} placeholder="ค้นหา username" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">การกระทำ</label>
            <select className="input-field" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}>
              <option value="">ทั้งหมด</option>
              {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">ตั้งแต่วันที่</label>
            <input type="date" className="input-field" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-gray-600">ถึงวันที่</label>
            <input type="date" className="input-field" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={loading}>ค้นหา</button>
            <button type="button" className="btn-secondary" onClick={resetFilters} disabled={loading}>ล้าง</button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
          <span>ทั้งหมด {total.toLocaleString('th-TH')} รายการ</span>
          <label className="flex items-center gap-2">
            แสดงต่อหน้า
            <select className="input-field py-1 w-24" value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}>
              {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {error && <p role="alert" className="px-4 py-3 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500">กำลังโหลด…</p>
        ) : !items.length ? (
          <p className="px-4 py-6 text-sm text-gray-500">ไม่พบประวัติตามเงื่อนไข</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">เวลา</th>
                  <th className="px-3 py-2 whitespace-nowrap">ผู้ใช้</th>
                  <th className="px-3 py-2 whitespace-nowrap">การกระทำ</th>
                  <th className="px-3 py-2">รายละเอียด</th>
                  <th className="px-3 py-2 whitespace-nowrap">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item._id} className="align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                      {new Date(item.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-medium text-gray-800">{item.username}</div>
                      {item.role && <div className="text-xs text-gray-500">{ROLE_LABELS[item.role] || item.role}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${actionTone(item.action)}`}>
                        {ACTION_LABELS[item.action] || item.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 break-words max-w-md">
                      {item.detail || '—'}
                      {item.targetId && (
                        <div className="text-xs text-gray-400">
                          {item.targetType === 'record' ? (
                            <a href={`/records/${item.targetId}`} className="underline hover:text-military-700">record {item.targetId}</a>
                          ) : (
                            <span>{item.targetType || 'target'} {item.targetId}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500" title={item.userAgent || ''}>{item.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 text-sm">
          <button type="button" className="btn-secondary" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>ก่อนหน้า</button>
          <span className="text-gray-600">หน้า {page} / {totalPages}</span>
          <button type="button" className="btn-secondary" disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>ถัดไป</button>
        </div>
      </div>
    </div>
  )
}
