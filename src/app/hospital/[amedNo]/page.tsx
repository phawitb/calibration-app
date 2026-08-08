'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface CalRecord {
  _id: string
  amedNo: string
  certNo?: string
  deviceName?: string
  brand?: string
  model?: string
  serialNo?: string
  unitName?: string
  section?: string
  calDate?: string
  calibrate?: string
  approve?: string
  calibratedById?: string
  approvedById?: string
  calibrationType?: string
  isoMethodCode?: string
}

export default function DeviceHistoryPage() {
  const params = useParams()
  const amedNo = decodeURIComponent(String(params.amedNo || ''))
  const [records, setRecords] = useState<CalRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!amedNo) return
    let mounted = true
    fetch(`/api/hospital/history?amedNo=${encodeURIComponent(amedNo)}`)
      .then(r => r.json())
      .then(j => { if (mounted) setRecords(Array.isArray(j.data) ? j.data : []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [amedNo])

  const deviceInfo = records[0]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/hospital" className="text-gray-400 hover:text-gray-600">&larr; เครื่องมือของหน่วย</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-military-900">ประวัติสอบเทียบ — AmedNo: {amedNo}</h1>
      </div>

      {deviceInfo && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div><span className="text-gray-500">ชื่อเครื่อง:</span> <strong>{deviceInfo.deviceName || '-'}</strong></div>
            <div><span className="text-gray-500">ยี่ห้อ:</span> {deviceInfo.brand || '-'}</div>
            <div><span className="text-gray-500">รุ่น:</span> {deviceInfo.model || '-'}</div>
            <div><span className="text-gray-500">S/N:</span> {deviceInfo.serialNo || '-'}</div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">กำลังโหลด...</p>
      ) : records.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          ยังไม่มีประวัติการสอบเทียบที่อนุมัติแล้ว
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r._id} className="card border border-gray-200">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      อนุมัติแล้ว
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      ใบรับรอง: {r.certNo || '-'}
                    </span>
                    {r.calibrationType === 'iso' && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">ISO {r.isoMethodCode || ''}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-x-4">
                    <span>วันที่สอบเทียบ: {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}</span>
                    <span>ผู้สอบ: {r.calibrate || '-'}</span>
                    <span>ผู้อนุมัติ: {r.approve || '-'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Calibration Certificate PDF */}
                  <a
                    href={`/api/certificates/${r._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded border border-military-300 text-military-700 hover:bg-military-50 font-medium"
                  >
                    ใบรับรองสอบเทียบ
                  </a>

                  {/* Technician Certificate */}
                  {r.calibratedById && (
                    <a
                      href={`/api/users/${r.calibratedById}/certificates`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium"
                      onClick={async (e) => {
                        e.preventDefault()
                        const res = await fetch(`/api/users/${r.calibratedById}/certificates`)
                        if (!res.ok) return
                        const j = await res.json()
                        const certs = j.data || []
                        if (certs.length === 0) {
                          alert('ผู้สอบเทียบยังไม่มีใบเซอร์')
                          return
                        }
                        // Open first cert
                        window.open(`/api/users/${r.calibratedById}/certificates/${certs[0]._id}`, '_blank')
                      }}
                    >
                      ใบเซอร์ผู้สอบ
                    </a>
                  )}

                  {/* Approver Certificate */}
                  {r.approvedById && (
                    <a
                      href="#"
                      className="text-xs px-3 py-1.5 rounded border border-green-300 text-green-700 hover:bg-green-50 font-medium"
                      onClick={async (e) => {
                        e.preventDefault()
                        const res = await fetch(`/api/users/${r.approvedById}/certificates`)
                        if (!res.ok) return
                        const j = await res.json()
                        const certs = j.data || []
                        if (certs.length === 0) {
                          alert('ผู้อนุมัติยังไม่มีใบเซอร์')
                          return
                        }
                        window.open(`/api/users/${r.approvedById}/certificates/${certs[0]._id}`, '_blank')
                      }}
                    >
                      ใบเซอร์ผู้อนุมัติ
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
