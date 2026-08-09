'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'

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

interface CalRecord {
  _id: string
  amedNo: string
  certNo?: string
  deviceName?: string
  brand?: string
  model?: string
  serialNo?: string
  calDate?: string
  calibrate?: string
  approve?: string
  calibratedById?: string
  approvedById?: string
  calibrationType?: string
  isoMethodCode?: string
}

export default function HospitalDevicesPage() {
  const { data: session } = useSession()
  const [devices, setDevices] = useState<AmedDevice[]>([])
  const [latestCals, setLatestCals] = useState<Record<string, LatestCal>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyMap, setHistoryMap] = useState<Record<string, CalRecord[]>>({})
  const [historyLoading, setHistoryLoading] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<string>('amedNo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
    let list = devices
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        (d.amedNo || '').toLowerCase().includes(q) ||
        (d.deviceName || '').toLowerCase().includes(q) ||
        (d.deviceNameTh || '').toLowerCase().includes(q) ||
        (d.brand || '').toLowerCase().includes(q) ||
        (d.section || '').toLowerCase().includes(q)
      )
    }
    const sorted = [...list].sort((a, b) => {
      let va = '', vb = ''
      switch (sortKey) {
        case 'amedNo': va = a.amedNo || ''; vb = b.amedNo || ''; break
        case 'deviceName': va = a.deviceName || a.deviceNameTh || ''; vb = b.deviceName || b.deviceNameTh || ''; break
        case 'brandModel': va = [a.brand, a.model].filter(Boolean).join(' '); vb = [b.brand, b.model].filter(Boolean).join(' '); break
        case 'serialNo': va = a.serialNo || ''; vb = b.serialNo || ''; break
        case 'section': va = a.section || ''; vb = b.section || ''; break
        case 'calDate': {
          const la = latestCals[a.amedNo]?.calDate || ''
          const lb = latestCals[b.amedNo]?.calDate || ''
          va = la; vb = lb; break
        }
      }
      const cmp = va.localeCompare(vb, 'th', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [devices, search, sortKey, sortDir, latestCals])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <span className="ml-1 text-military-400 opacity-40">{'\u2195'}</span>
    return <span className="ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
  }

  const toggleExpand = useCallback(async (amedNo: string) => {
    if (expandedId === amedNo) {
      setExpandedId(null)
      return
    }
    setExpandedId(amedNo)

    // Load history if not cached
    if (!historyMap[amedNo]) {
      setHistoryLoading(amedNo)
      try {
        const res = await fetch(`/api/hospital/history?amedNo=${encodeURIComponent(amedNo)}`)
        const j = await res.json()
        setHistoryMap(prev => ({ ...prev, [amedNo]: Array.isArray(j.data) ? j.data : [] }))
      } catch {
        setHistoryMap(prev => ({ ...prev, [amedNo]: [] }))
      }
      setHistoryLoading(null)
    }
  }, [expandedId, historyMap])

  const openCert = async (userId: string, label: string) => {
    const res = await fetch(`/api/users/${userId}/certificates`)
    if (!res.ok) return
    const j = await res.json()
    const certs = j.data || []
    if (certs.length === 0) {
      alert(`${label}ยังไม่มีใบเซอร์`)
      return
    }
    window.open(`/api/users/${userId}/certificates/${certs[0]._id}`, '_blank')
  }

  if (!hospitalUnit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <p className="text-gray-500 text-center">ไม่พบข้อมูลหน่วยงานของคุณ<br />กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-military-900">เครื่องมือของหน่วย</h1>
        <p className="text-sm text-gray-500 mt-1">
          {hospitalUnit} — {filtered.length} เครื่อง
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        className="input-field max-w-md"
        placeholder="ค้นหา AmedNo, ชื่อเครื่อง, ยี่ห้อ..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white select-none">
              <tr>
                <th className="py-3 px-3 text-left font-medium w-8"></th>
                <th className="py-3 px-3 text-left font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('amedNo')}>
                  AmedNo<SortIcon col="amedNo" />
                </th>
                <th className="py-3 px-3 text-left font-medium cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('deviceName')}>
                  ชื่อเครื่อง<SortIcon col="deviceName" />
                </th>
                <th className="py-3 px-3 text-left font-medium hidden md:table-cell cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('brandModel')}>
                  ยี่ห้อ / รุ่น<SortIcon col="brandModel" />
                </th>
                <th className="py-3 px-3 text-left font-medium hidden lg:table-cell cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('serialNo')}>
                  S/N<SortIcon col="serialNo" />
                </th>
                <th className="py-3 px-3 text-left font-medium hidden lg:table-cell cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('section')}>
                  แผนก<SortIcon col="section" />
                </th>
                <th className="py-3 px-3 text-left font-medium hidden md:table-cell cursor-pointer hover:bg-military-700 transition-colors" onClick={() => toggleSort('calDate')}>
                  สอบเทียบล่าสุด<SortIcon col="calDate" />
                </th>
                <th className="py-3 px-3 text-center font-medium hidden md:table-cell">สถานะ</th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">กำลังโหลด...</td></tr>
              </tbody>
            ) : filtered.length === 0 ? (
              <tbody>
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">
                  {search ? 'ไม่พบเครื่องมือที่ค้นหา' : 'ยังไม่มีเครื่องมือในระบบ'}
                </td></tr>
              </tbody>
            ) : filtered.map((d, i) => {
              const latest = latestCals[d.amedNo]
              const isExpanded = expandedId === d.amedNo
              const history = historyMap[d.amedNo]
              const isLoadingHistory = historyLoading === d.amedNo

              return (
                <tbody key={d._id}>
                    {/* Main row */}
                    <tr
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isExpanded ? 'bg-military-50' : i % 2 === 0 ? '' : 'bg-gray-50/50'} hover:bg-military-50`}
                      onClick={() => toggleExpand(d.amedNo)}
                    >
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block transition-transform text-gray-400 text-xs ${isExpanded ? 'rotate-90' : ''}`}>
                          &#9654;
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-military-800">{d.amedNo}</td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-gray-800">{d.deviceName || d.deviceNameTh || '-'}</div>
                        <div className="text-xs text-gray-400 md:hidden">
                          {[d.brand, d.model].filter(Boolean).join(' / ')}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-600 hidden md:table-cell">
                        {[d.brand, d.model].filter(Boolean).join(' / ') || '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-600 hidden lg:table-cell">{d.serialNo || '-'}</td>
                      <td className="py-3 px-3 text-gray-600 hidden lg:table-cell">{d.section || '-'}</td>
                      <td className="py-3 px-3 text-gray-600 hidden md:table-cell whitespace-nowrap">
                        {latest?.calDate ? new Date(latest.calDate).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3 px-3 text-center hidden md:table-cell">
                        {latest?.approvalStatus === 'approved' ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">อนุมัติแล้ว</span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-gray-50 border-b border-gray-200 p-0">
                          <div className="px-6 py-4 space-y-4">
                            {/* Device info summary (visible on mobile) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm md:hidden">
                              <div><span className="text-gray-400">ยี่ห้อ:</span> {d.brand || '-'}</div>
                              <div><span className="text-gray-400">รุ่น:</span> {d.model || '-'}</div>
                              <div><span className="text-gray-400">S/N:</span> {d.serialNo || '-'}</div>
                              <div><span className="text-gray-400">แผนก:</span> {d.section || '-'}</div>
                            </div>

                            <h4 className="text-sm font-semibold text-military-800">
                              ประวัติการสอบเทียบ
                            </h4>

                            {isLoadingHistory ? (
                              <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                                <div className="animate-spin h-4 w-4 border-2 border-military-300 border-t-military-700 rounded-full" />
                                กำลังโหลด...
                              </div>
                            ) : !history || history.length === 0 ? (
                              <p className="text-sm text-gray-400 py-2">ยังไม่มีประวัติการสอบเทียบที่อนุมัติแล้ว</p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="py-2 px-3 text-left font-medium text-gray-600">วันที่สอบเทียบ</th>
                                      <th className="py-2 px-3 text-left font-medium text-gray-600">เลขที่ใบรับรอง</th>
                                      <th className="py-2 px-3 text-left font-medium text-gray-600 hidden sm:table-cell">ผู้สอบเทียบ</th>
                                      <th className="py-2 px-3 text-left font-medium text-gray-600 hidden sm:table-cell">ผู้อนุมัติ</th>
                                      <th className="py-2 px-3 text-center font-medium text-gray-600">เอกสาร</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.map((r, rIdx) => (
                                      <tr key={r._id} className={`border-t border-gray-100 ${rIdx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}
                                          {rIdx === 0 && (
                                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">ล่าสุด</span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3">{r.certNo || '-'}</td>
                                        <td className="py-2 px-3 hidden sm:table-cell text-gray-600">{r.calibrate || '-'}</td>
                                        <td className="py-2 px-3 hidden sm:table-cell text-gray-600">{r.approve || '-'}</td>
                                        <td className="py-2 px-3">
                                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            <a
                                              href={`/records/${r._id}/pdf`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs px-2 py-1 rounded border border-military-300 text-military-700 hover:bg-military-50 font-medium whitespace-nowrap"
                                            >
                                              ใบรับรอง
                                            </a>
                                            {r.calibratedById && (
                                              <button
                                                type="button"
                                                className="text-xs px-2 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium whitespace-nowrap"
                                                onClick={(e) => { e.stopPropagation(); openCert(r.calibratedById!, 'ผู้สอบเทียบ') }}
                                              >
                                                เซอร์ผู้สอบ
                                              </button>
                                            )}
                                            {r.approvedById && (
                                              <button
                                                type="button"
                                                className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 font-medium whitespace-nowrap"
                                                onClick={(e) => { e.stopPropagation(); openCert(r.approvedById!, 'ผู้อนุมัติ') }}
                                              >
                                                เซอร์ผู้อนุมัติ
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                </tbody>
              )
            })}
          </table>
        </div>
      </div>
    </div>
  )
}
