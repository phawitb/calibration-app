'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface AmedDevice {
  _id: string
  amedNo: string
  unitName: string
  section?: string
  deviceName?: string
  deviceNameTh?: string
  brand?: string
  model?: string
  serialNo?: string
}

interface LatestCal {
  amedNo: string
  calDate?: string
  certNo?: string
  approvalStatus?: string
}

export default function HospitalDevicesPage() {
  const { data: session } = useSession()
  const [devices, setDevices] = useState<AmedDevice[]>([])
  const [latestCals, setLatestCals] = useState<Record<string, LatestCal>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const hospitalUnit = (session?.user as any)?.hospitalUnit || ''

  useEffect(() => {
    if (!hospitalUnit) return
    let mounted = true

    const loadDevices = fetch(`/api/ameddevices?unitName=${encodeURIComponent(hospitalUnit)}`)
      .then(r => r.json())
      .then(j => {
        if (mounted) setDevices(Array.isArray(j.data) ? j.data : [])
      })

    const loadLatest = fetch(`/api/hospital/latest?unitName=${encodeURIComponent(hospitalUnit)}`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(j => {
        if (!mounted) return
        const map: Record<string, LatestCal> = {}
        for (const r of (j.data || [])) {
          map[r.amedNo] = r
        }
        setLatestCals(map)
      })
      .catch(() => {})

    Promise.allSettled([loadDevices, loadLatest]).finally(() => {
      if (mounted) setLoading(false)
    })

    return () => { mounted = false }
  }, [hospitalUnit])

  const filtered = useMemo(() => {
    if (!search.trim()) return devices
    const q = search.toLowerCase()
    return devices.filter(d =>
      (d.amedNo || '').toLowerCase().includes(q) ||
      (d.deviceName || '').toLowerCase().includes(q) ||
      (d.deviceNameTh || '').toLowerCase().includes(q) ||
      (d.brand || '').toLowerCase().includes(q) ||
      (d.section || '').toLowerCase().includes(q)
    )
  }, [devices, search])

  if (!hospitalUnit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🏥</div>
        <p className="text-gray-500 text-center">ไม่พบข้อมูลหน่วยงานของคุณ<br />กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-military-900">เครื่องมือของหน่วย</h1>
          <p className="text-sm text-gray-500 mt-1">
            {hospitalUnit} — {filtered.length} เครื่อง
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
        </svg>
        <input
          type="text"
          className="input-field pl-9 w-full"
          placeholder="ค้นหา AmedNo, ชื่อเครื่อง, ยี่ห้อ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Device cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-military-300 border-t-military-700 rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📋</div>
          <p className="text-gray-400">{search ? 'ไม่พบเครื่องมือที่ค้นหา' : 'ยังไม่มีเครื่องมือในระบบ'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d => {
            const latest = latestCals[d.amedNo]
            return (
              <Link
                key={d._id}
                href={`/hospital/${encodeURIComponent(d.amedNo)}`}
                className="block card border border-gray-200 hover:border-military-400 hover:shadow-md transition-all group"
              >
                {/* Device header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-block text-xs font-mono font-semibold px-2 py-0.5 rounded bg-military-100 text-military-800">
                      {d.amedNo}
                    </span>
                  </div>
                  <span className="text-military-400 group-hover:text-military-700 transition-colors text-lg">&rarr;</span>
                </div>

                {/* Device name */}
                <h3 className="font-semibold text-gray-900 mb-1 leading-snug">
                  {d.deviceName || d.deviceNameTh || '-'}
                </h3>

                {/* Details */}
                <div className="text-xs text-gray-500 space-y-0.5">
                  {(d.brand || d.model) && (
                    <p>{[d.brand, d.model].filter(Boolean).join(' / ')}</p>
                  )}
                  {d.serialNo && <p>S/N: {d.serialNo}</p>}
                  {d.section && <p>แผนก: {d.section}</p>}
                </div>

                {/* Latest calibration info */}
                {latest && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      สอบเทียบล่าสุด: {latest.calDate ? new Date(latest.calDate).toLocaleDateString('th-TH') : '-'}
                    </div>
                    {latest.approvalStatus === 'approved' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        อนุมัติแล้ว
                      </span>
                    )}
                  </div>
                )}
                {!latest && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">ยังไม่มีประวัติสอบเทียบ</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
