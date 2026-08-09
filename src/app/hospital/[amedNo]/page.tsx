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
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/hospital" className="text-military-600 hover:text-military-800 font-medium">
          เครื่องมือของหน่วย
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600">{amedNo}</span>
      </div>

      {/* Device info card */}
      <div className="card border border-military-200 bg-gradient-to-r from-military-50 to-white">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-military-100 flex items-center justify-center text-xl flex-shrink-0">
            🔬
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-military-200 text-military-800">
                {amedNo}
              </span>
              {deviceInfo?.calibrationType === 'iso' && (
                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">ISO</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-military-900 mb-2">
              {deviceInfo?.deviceName || 'กำลังโหลด...'}
            </h1>
            {deviceInfo && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-400">ยี่ห้อ:</span>{' '}
                  <span className="text-gray-700">{deviceInfo.brand || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">รุ่น:</span>{' '}
                  <span className="text-gray-700">{deviceInfo.model || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">S/N:</span>{' '}
                  <span className="text-gray-700">{deviceInfo.serialNo || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-400">แผนก:</span>{' '}
                  <span className="text-gray-700">{deviceInfo.section || '-'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calibration history */}
      <div>
        <h2 className="text-lg font-semibold text-military-800 mb-3">
          ประวัติการสอบเทียบ
          {records.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">({records.length} รายการ)</span>
          )}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-military-300 border-t-military-700 rounded-full" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📄</div>
            <p className="text-gray-400">ยังไม่มีประวัติการสอบเทียบที่อนุมัติแล้ว</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r, idx) => (
              <div key={r._id} className="card border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex flex-col gap-3">
                  {/* Top row: status + cert + date */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      อนุมัติแล้ว
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      ใบรับรอง: {r.certNo || '-'}
                    </span>
                    {idx === 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        ล่าสุด
                      </span>
                    )}
                    {r.calibrationType === 'iso' && r.isoMethodCode && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200">
                        ISO {r.isoMethodCode}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0">
                        <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600">
                        {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0">
                        <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                      </svg>
                      <span className="text-gray-600">ผู้สอบ: {r.calibrate || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 flex-shrink-0">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-600">ผู้อนุมัติ: {r.approve || '-'}</span>
                    </div>
                  </div>

                  {/* Download buttons */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`/records/${r._id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-military-300 text-military-700 hover:bg-military-50 font-medium transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                      </svg>
                      ใบรับรองสอบเทียบ
                    </a>

                    {r.calibratedById && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium transition-colors"
                        onClick={async () => {
                          const res = await fetch(`/api/users/${r.calibratedById}/certificates`)
                          if (!res.ok) return
                          const j = await res.json()
                          const certs = j.data || []
                          if (certs.length === 0) {
                            alert('ผู้สอบเทียบยังไม่มีใบเซอร์')
                            return
                          }
                          window.open(`/api/users/${r.calibratedById}/certificates/${certs[0]._id}`, '_blank')
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                        </svg>
                        ใบเซอร์ผู้สอบ
                      </button>
                    )}

                    {r.approvedById && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium transition-colors"
                        onClick={async () => {
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
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                        </svg>
                        ใบเซอร์ผู้อนุมัติ
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
