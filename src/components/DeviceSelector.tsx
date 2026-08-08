'use client'

import { useState, useEffect, useMemo } from 'react'

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
  hpNumber?: string
}

interface Props {
  unitName: string
  onSelect: (device: AmedDevice) => void
}

export default function DeviceSelector({ unitName, onSelect }: Props) {
  const [devices, setDevices] = useState<AmedDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!unitName) { setDevices([]); return }
    let mounted = true
    setLoading(true)
    setSelectedId(null)
    fetch(`/api/ameddevices?unitName=${encodeURIComponent(unitName)}`)
      .then(r => r.json())
      .then(j => { if (mounted) setDevices(Array.isArray(j.data) ? j.data : []) })
      .catch(() => { if (mounted) setDevices([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [unitName])

  const filtered = useMemo(() => {
    if (!search.trim()) return devices
    const q = search.toLowerCase()
    return devices.filter(d =>
      (d.amedNo || '').toLowerCase().includes(q) ||
      (d.deviceName || '').toLowerCase().includes(q) ||
      (d.deviceNameTh || '').toLowerCase().includes(q) ||
      (d.brand || '').toLowerCase().includes(q) ||
      (d.model || '').toLowerCase().includes(q) ||
      (d.serialNo || '').toLowerCase().includes(q) ||
      (d.section || '').toLowerCase().includes(q)
    )
  }, [devices, search])

  if (loading) {
    return <div className="text-center text-gray-500 py-8">กำลังโหลดรายการเครื่องมือ...</div>
  }

  if (!devices.length) {
    return <div className="text-center text-gray-400 py-8">ไม่พบเครื่องมือในหน่วยงานนี้</div>
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        className="input-field"
        placeholder="ค้นหา AmedNo, ชื่อเครื่อง, ยี่ห้อ, รุ่น..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="text-sm text-gray-500">
        {filtered.length} รายการ {search ? `(กรองจาก ${devices.length})` : ''}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-800 text-white">
              <tr>
                <th className="py-2 px-3 text-left font-medium">AmedNo</th>
                <th className="py-2 px-3 text-left font-medium">ชื่อเครื่อง</th>
                <th className="py-2 px-3 text-left font-medium hidden md:table-cell">ยี่ห้อ</th>
                <th className="py-2 px-3 text-left font-medium hidden md:table-cell">รุ่น</th>
                <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">Serial No.</th>
                <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">แผนก</th>
                <th className="py-2 px-3 text-center font-medium">เลือก</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr
                  key={d._id}
                  className={`border-b border-gray-50 cursor-pointer transition-colors ${
                    selectedId === d._id ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : 'hover:bg-military-50'
                  }`}
                  onClick={() => { setSelectedId(d._id); onSelect(d) }}
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-military-800">{d.amedNo}</td>
                  <td className="py-2.5 px-3 text-gray-700">
                    {d.deviceName || d.deviceNameTh || '-'}
                    {d.deviceNameTh && d.deviceName && (
                      <span className="text-xs text-gray-400 ml-1">({d.deviceNameTh})</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-gray-600 hidden md:table-cell">{d.brand || '-'}</td>
                  <td className="py-2.5 px-3 text-gray-600 hidden md:table-cell">{d.model || '-'}</td>
                  <td className="py-2.5 px-3 text-gray-500 hidden lg:table-cell font-mono text-xs">{d.serialNo || '-'}</td>
                  <td className="py-2.5 px-3 text-gray-500 hidden lg:table-cell">{d.section || '-'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <div className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center ${
                      selectedId === d._id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedId === d._id && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      )}
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
