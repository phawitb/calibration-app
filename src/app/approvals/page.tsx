'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-military-900">งานรออนุมัติ</h1>
        <button onClick={load} className="btn-secondary">รีเฟรช</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white">
              <tr>
                <th className="text-left py-3 px-4 font-medium">ใบรับรอง</th>
                <th className="text-left py-3 px-4 font-medium">เครื่องมือ</th>
                <th className="text-left py-3 px-4 font-medium">โรงพยาบาล</th>
                <th className="text-left py-3 px-4 font-medium">วันที่สอบเทียบ</th>
                <th className="text-left py-3 px-4 font-medium">ผู้ขออนุมัติ</th>
                <th className="text-center py-3 px-4 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">ไม่มีงานรออนุมัติ</td></tr>
              ) : rows.map((r) => (
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
