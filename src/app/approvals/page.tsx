'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useTableSort, sortIcon } from '@/hooks/useTableSort'

type PendingRow = {
  _id: string
  certNo?: string
  amedNo?: string
  deviceName?: string
  unitName?: string
  calDate?: string
  requestedApproverName?: string
}

export default function ApprovalsPage() {
  const [rows, setRows] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useTableSort(rows)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/approvals/pending')
    const json = await res.json()
    setRows(Array.isArray(json.rows) ? json.rows : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const approve = async (id: string) => {
    setBusyId(id)
    const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
    setBusyId(null)
    if (res.ok) {
      toast.success('อนุมัติเรียบร้อย')
      load()
      return
    }
    const json = await res.json().catch(() => ({}))
    toast.error(json.error || 'อนุมัติไม่สำเร็จ')
  }

  const openReject = (id: string) => {
    setRejectId(id)
    setRejectComment('')
  }

  const doReject = async () => {
    if (!rejectId) return
    if (!rejectComment.trim()) {
      toast.error('กรุณาระบุเหตุผล')
      return
    }
    setRejecting(true)
    const res = await fetch(`/api/approvals/${rejectId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: rejectComment }),
    })
    setRejecting(false)
    if (res.ok) {
      toast.success('ไม่อนุมัติเรียบร้อย — ส่งกลับให้แก้ไข')
      setRejectId(null)
      load()
    } else {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-military-900">งานรออนุมัติ</h1>
        <button onClick={load} className="btn-secondary">รีเฟรช</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white select-none">
              <tr>
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('certNo')}>ใบรับรอง{sortIcon(sortKey, sortDir, 'certNo')}</th>
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('deviceName')}>เครื่องมือ{sortIcon(sortKey, sortDir, 'deviceName')}</th>
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('unitName')}>โรงพยาบาล{sortIcon(sortKey, sortDir, 'unitName')}</th>
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('calDate')}>วันที่สอบเทียบ{sortIcon(sortKey, sortDir, 'calDate')}</th>
                <th className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('requestedApproverName')}>ผู้ขออนุมัติ{sortIcon(sortKey, sortDir, 'requestedApproverName')}</th>
                <th className="text-center py-3 px-4 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : sortedRows.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">ไม่มีงานรออนุมัติ</td></tr>
              ) : sortedRows.map((r) => (
                <tr key={r._id} className="border-b border-gray-50 hover:bg-military-50">
                  <td className="py-3 px-4">{r.certNo || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-military-800">{r.deviceName || '-'}</div>
                    <div className="text-xs text-gray-400">Amed: {r.amedNo || '-'}</div>
                  </td>
                  <td className="py-3 px-4">{r.unitName || '-'}</td>
                  <td className="py-3 px-4">{r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}</td>
                  <td className="py-3 px-4">{r.requestedApproverName || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/records/${r._id}`} className="btn-secondary text-xs px-2 py-1">ดู</Link>
                      <button
                        className="btn-primary text-xs px-2 py-1"
                        disabled={busyId === r._id}
                        onClick={() => approve(r._id)}
                      >
                        {busyId === r._id ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
                        disabled={busyId === r._id}
                        onClick={() => openReject(r._id)}
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-bold text-red-700">ไม่อนุมัติ</h3>
            <p className="text-sm text-gray-600">กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อให้ผู้สร้างรายการแก้ไข</p>
            <textarea
              className="input-field w-full h-28 text-sm"
              placeholder="เหตุผลที่ไม่อนุมัติ..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary text-sm"
                onClick={() => setRejectId(null)}
                disabled={rejecting}
              >
                ยกเลิก
              </button>
              <button
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
                onClick={doReject}
                disabled={rejecting}
              >
                {rejecting ? 'กำลังดำเนินการ...' : 'ยืนยันไม่อนุมัติ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
