'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type HistoryRow = {
  _id: string
  amedNo?: string
  amedCertKey?: string
  certNo?: string
  deviceName?: string
  brand?: string
  model?: string
  serialNo?: string
  calDate?: string
  approvalStatus?: string
}

export default function RecordAmedHistoryPanel({
  amedNo,
  currentRecordId,
  currentCertNo,
}: {
  amedNo?: string
  currentRecordId: string
  currentCertNo?: string
}) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const key = String(amedNo || '').trim()
    if (!key) {
      setRows([])
      setLoading(false)
      return
    }
    let disposed = false
    setLoading(true)
    fetch(`/api/records/history?amedNo=${encodeURIComponent(key)}`)
      .then((res) => (res.ok ? res.json() : { records: [] }))
      .then((data) => {
        if (!disposed) setRows(Array.isArray(data.records) ? data.records : [])
      })
      .catch(() => {
        if (!disposed) setRows([])
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [amedNo])

  if (loading) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">กำลังโหลดประวัติอาร์เมด...</p>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="card">
        <p className="text-sm text-gray-500">ไม่พบประวัติย้อนหลังของอาร์เมดนี้</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-600">
        ประวัติอาร์เมดหมายเลข <span className="font-semibold text-military-800">{amedNo}</span> ({rows.length} รายการ)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-military-800 text-white">
            <tr>
              <th className="text-left py-3 px-4 font-medium">คีย์รายการ</th>
              <th className="text-left py-3 px-4 font-medium">เลขที่ใบรับรอง</th>
              <th className="text-left py-3 px-4 font-medium">วันที่สอบเทียบ</th>
              <th className="text-left py-3 px-4 font-medium">เครื่องมือ</th>
              <th className="text-left py-3 px-4 font-medium">สถานะ</th>
              <th className="text-center py-3 px-4 font-medium">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rowCert = String(r.certNo || '').trim()
              const currentCert = String(currentCertNo || '').trim()
              const isCurrent = currentCert
                ? rowCert === currentCert
                : r._id === currentRecordId
              return (
                <tr key={r._id} className={isCurrent ? 'bg-amber-50' : 'border-b border-gray-50'}>
                  <td className="py-3 px-4 font-mono text-xs text-military-700">{r.amedCertKey || '-'}</td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/records/${r._id}`}
                      className="text-blue-700 hover:text-blue-900 underline underline-offset-2 font-medium"
                    >
                      {r.certNo || '-'}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-800">{r.deviceName || '-'}</div>
                    <div className="text-xs text-gray-400">{r.brand || ''} {r.model || ''} {r.serialNo ? `| SN ${r.serialNo}` : ''}</div>
                  </td>
                  <td className="py-3 px-4">{r.approvalStatus || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    {isCurrent ? (
                      <span className="text-xs text-amber-700 font-medium">รายการที่กำลังเปิด</span>
                    ) : (
                      <Link
                        href={`/api/certificates/${r._id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-military-600 hover:text-military-800 font-medium text-xs px-2 py-1 rounded border border-military-200 hover:bg-military-50"
                      >
                        เปิด PDF
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
