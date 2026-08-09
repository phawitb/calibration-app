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
  toSelect?: boolean
  uc1?: string
  uc2?: string
  uc3?: string
  uc4?: string
  uc5?: string
  uc6?: string
  ucT?: string
}

interface Props {
  unitName: string
  onSelect: (device: AmedDevice) => void
  disabled?: boolean
}

export default function DeviceSelector({ unitName, onSelect, disabled }: Props) {
  const [devices, setDevices] = useState<AmedDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!unitName) { setDevices([]); return }
    let mounted = true
    setLoading(true)
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
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => {
                const isSelected = selectedId === d._id
                return (
                <tr
                  key={d._id}
                  className={`border-b border-gray-50 transition-colors ${
                    isSelected
                      ? 'bg-military-100'
                      : disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-military-50'
                  }`}
                  onClick={() => {
                    if (disabled) return
                    setSelectedId(d._id)
                    onSelect(d)
                  }}
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-military-800">
                    {isSelected && (
                      <span className="inline-block w-4 h-4 mr-2 align-middle border-2 border-military-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {d.amedNo}
                  </td>
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
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
