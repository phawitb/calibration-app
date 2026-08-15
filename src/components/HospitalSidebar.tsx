'use client'

import { useMemo, useState } from 'react'
import { displayHospitalName } from '@/lib/hospitalUnit'
import { useHospitalWorkspace } from '@/components/HospitalWorkspace'

export default function HospitalSidebar() {
  const {
    hospitals,
    selectedHospital,
    setSelectedHospital,
    loading,
    locked,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useHospitalWorkspace()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return hospitals
    return hospitals.filter((h) => h.toLowerCase().includes(q))
  }, [hospitals, query])

  const list = (
    <ul className="px-2 space-y-0.5">
      {filtered.map((hospital) => {
        const { title, subtitle } = displayHospitalName(hospital)
        const active = hospital === selectedHospital
        return (
          <li key={hospital}>
            <button
              type="button"
              onClick={() => setSelectedHospital(hospital)}
              disabled={locked && !active}
              title={hospital}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-gold-400/15 text-white ring-1 ring-gold-400/50'
                  : 'text-military-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`block truncate text-sm font-medium ${active ? 'text-gold-400' : ''}`}>
                {title || hospital}
              </span>
              {subtitle && (
                <span className="mt-0.5 block truncate text-[11px] text-military-300">{subtitle}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const fullNav = (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-400/90">Workspace</p>
            <h2 className="text-sm font-semibold text-white truncate">เลือกโรงพยาบาล</h2>
          </div>
          <button
            type="button"
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-military-200 hover:bg-white/10 hover:text-white"
            title="ย่อแถบโรงพยาบาล"
            onClick={() => setSidebarCollapsed(true)}
          >
            «
          </button>
          <button
            type="button"
            className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-military-200 hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหา รพ. / หน่วยงาน"
          className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-military-300/70 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
          disabled={locked}
        />
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <p className="px-4 py-6 text-sm text-military-300">กำลังโหลดรายชื่อ รพ....</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-military-300">ไม่พบโรงพยาบาล</p>
        ) : list}
      </div>
      <div className="border-t border-white/10 px-3 py-3 text-[11px] text-military-300">
        {selectedHospital ? 'กำลังทำงานในหน่วยงานที่เลือก' : 'เลือก รพ. เพื่อเริ่มดูข้อมูล'}
      </div>
    </div>
  )

  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="ปิดแถบโรงพยาบาล"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-military-900 text-white shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[280px]'}`}
      >
        {sidebarCollapsed ? (
          <>
            <div className="hidden lg:flex h-full flex-col">
              <div className="px-2 pt-4 pb-3 border-b border-white/10 flex justify-center">
                <button
                  type="button"
                  className="h-8 w-8 rounded-md text-gold-400 hover:bg-white/10"
                  title="ขยายแถบโรงพยาบาล"
                  onClick={() => setSidebarCollapsed(false)}
                >
                  »
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2 px-1">
                {filtered.slice(0, 24).map((hospital) => {
                  const { title } = displayHospitalName(hospital)
                  const active = hospital === selectedHospital
                  return (
                    <button
                      key={hospital}
                      type="button"
                      title={hospital}
                      onClick={() => setSelectedHospital(hospital)}
                      className={`mb-1 flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold ${
                        active ? 'bg-gold-400/20 text-gold-400' : 'text-military-200 hover:bg-white/10'
                      }`}
                    >
                      {(title || hospital).slice(0, 2)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="lg:hidden h-full">{fullNav}</div>
          </>
        ) : fullNav}
      </aside>
    </>
  )
}
