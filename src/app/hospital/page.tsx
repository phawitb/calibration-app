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

export default function HospitalDevicesPage() {
  const { data: session } = useSession()
  const [devices, setDevices] = useState<AmedDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const hospitalUnit = (session?.user as any)?.hospitalUnit || ''

  useEffect(() => {
    if (!hospitalUnit) return
    let mounted = true
    fetch(`/api/ameddevices?unitName=${encodeURIComponent(hospitalUnit)}`)
      .then(r => r.json())
      .then(j => { if (mounted) setDevices(Array.isArray(j.data) ? j.data : []) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
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
      <div className="text-center text-gray-500 py-12">
        ไม่พบข้อมูลหน่วยงานของคุณ กรุณาติดต่อผู้ดูแลระบบ
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-military-900">เครื่องมือของหน่วย</h1>
      <p className="text-sm text-gray-500">หน่วยงาน: <strong>{hospitalUnit}</strong></p>

      <input
        type="text"
        className="input-field max-w-md"
        placeholder="ค้นหา AmedNo, ชื่อเครื่อง, ยี่ห้อ..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-gray-500 text-sm">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">ไม่พบเครื่องมือ</p>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-military-800 text-white">
                <tr>
                  <th className="py-2.5 px-3 text-left font-medium">AmedNo</th>
                  <th className="py-2.5 px-3 text-left font-medium">ชื่อเครื่อง</th>
                  <th className="py-2.5 px-3 text-left font-medium hidden md:table-cell">ยี่ห้อ</th>
                  <th className="py-2.5 px-3 text-left font-medium hidden md:table-cell">รุ่น</th>
                  <th className="py-2.5 px-3 text-left font-medium hidden lg:table-cell">แผนก</th>
                  <th className="py-2.5 px-3 text-center font-medium">ประวัติ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d._id} className="border-b border-gray-50 hover:bg-military-50">
                    <td className="py-2.5 px-3 font-mono font-medium text-military-800">{d.amedNo}</td>
                    <td className="py-2.5 px-3 text-gray-700">{d.deviceName || d.deviceNameTh || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600 hidden md:table-cell">{d.brand || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-600 hidden md:table-cell">{d.model || '-'}</td>
                    <td className="py-2.5 px-3 text-gray-500 hidden lg:table-cell">{d.section || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Link
                        href={`/hospital/${encodeURIComponent(d.amedNo)}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1 rounded border border-blue-200 hover:bg-blue-50"
                      >
                        ดูประวัติ
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
