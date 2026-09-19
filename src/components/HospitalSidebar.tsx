'use client'
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { navigationSection } from '@/lib/appNavigation'
import { useOrderWorkspace } from './OrderWorkspace'
import { displayHospitalName } from '@/lib/hospitalUnit'
import { useHospitalWorkspace } from './HospitalWorkspace'

export default function HospitalSidebar() {
  const pathname = usePathname()
  const showOrderSelector = navigationSection(pathname) === 'add'
  const {
    orders,
    selectedOrder,
    allOrdersSelected,
    selectOrder,
    loading: ordersLoading,
  } = useOrderWorkspace()
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
  const showHospitals =
    !showOrderSelector || (!!selectedOrder && !ordersLoading)
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () =>
      hospitals.filter((h) =>
        h.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [hospitals, query]
  )
  const sidebarControls = (
    <>
      <button
        type="button"
        className="hidden lg:block rounded px-2 py-1 text-military-200 hover:bg-white/10"
        title="ย่อแถบด้านซ้าย"
        onClick={() => setSidebarCollapsed(true)}
      >
        «
      </button>
      <button
        type="button"
        className="lg:hidden rounded px-2 py-1 text-military-200 hover:bg-white/10"
        aria-label="ปิดแถบด้านซ้าย"
        onClick={() => setSidebarOpen(false)}
      >
        ✕
      </button>
    </>
  )
  const fullNav = (
    <div className="flex h-full min-h-0 flex-col">
      {showOrderSelector && (
        <section className="border-b border-white/10 px-4 py-4">
          {!showHospitals && (
            <div className="mb-2 flex justify-end">{sidebarControls}</div>
          )}
          <label className="block text-sm font-semibold text-white">
            เลือกคำสั่ง
            <select
              className="mt-3 w-full rounded-lg border border-white/20 bg-military-800 px-3 py-2.5 text-sm font-normal text-white focus:ring-2 focus:ring-gold-400"
              value={allOrdersSelected ? 'all' : selectedOrder?._id || 'all'}
              disabled={ordersLoading}
              onChange={(e) => {
                selectOrder(e.target.value)
                setQuery('')
              }}
            >
              <option value="all">ทุกคำสั่ง</option>
              {orders.map((order) => (
                <option key={order._id} value={order._id}>
                  {order.orderNo} · {order.title}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {showHospitals && (
        <>
          <section className="border-b border-white/10 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                โรงพยาบาล ({hospitals.length})
              </h2>
              {sidebarControls}
            </div>
          </section>
          <section className="flex flex-1 min-h-0 flex-col">
            <div className="px-4 pt-4 pb-3 space-y-3">
              <input
                type="search"
                aria-label="ค้นหาโรงพยาบาล"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหา รพ. / หน่วยงาน"
                className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-military-300/70 focus:outline-none focus:ring-2 focus:ring-gold-400/60"
                disabled={locked}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {!locked && pathname === '/dashboard' && (
                <button
                  type="button"
                  aria-pressed={!selectedHospital}
                  onClick={() => setSelectedHospital('')}
                  className={`mb-2 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium ${!selectedHospital ? 'bg-gold-400/15 text-gold-400 ring-1 ring-gold-400/50' : 'text-military-100 hover:bg-white/10'}`}
                >
                  ภาพรวมทุกโรงพยาบาล
                </button>
              )}
              {loading ? (
                <p className="px-2 py-6 text-sm text-military-300">
                  กำลังโหลดรายชื่อ รพ.…
                </p>
              ) : !filtered.length ? (
                <p className="px-2 py-6 text-sm text-military-300">
                  ไม่พบโรงพยาบาล
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((hospital) => {
                    const { title, subtitle } = displayHospitalName(hospital),
                      active = hospital === selectedHospital
                    return (
                      <li key={hospital}>
                        <button
                          type="button"
                          disabled={locked && !active}
                          onClick={() => setSelectedHospital(hospital)}
                          title={hospital}
                          aria-pressed={active}
                          className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-gold-400/15 ring-1 ring-gold-400/50 text-gold-400' : 'text-military-100 hover:bg-white/10'}`}
                        >
                          <span className="block text-sm font-medium">
                            {title || hospital}
                          </span>
                          {subtitle && (
                            <span className="mt-0.5 block text-xs text-military-300">
                              {subtitle}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>
          <p className="border-t border-white/10 px-4 py-3 text-xs text-military-300">
            {selectedHospital
              ? 'กำลังทำงานในโรงพยาบาลที่เลือก'
              : 'เลือก รพ. เพื่อเริ่มดูข้อมูล'}
          </p>
        </>
      )}
    </div>
  )
  return (
    <>
      {sidebarOpen && (
        <button
          type="button"
          className="print:hidden fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="ปิดแถบด้านซ้าย"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        aria-label={showOrderSelector ? 'เลือกคำสั่งและโรงพยาบาล' : 'โรงพยาบาล'}
        className={`print:hidden fixed inset-y-0 left-0 z-50 w-[280px] bg-military-900 text-white shadow-xl transition-transform lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:z-auto lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:w-[64px]' : 'lg:w-[280px]'}`}
      >
        {sidebarCollapsed ? (
          <>
            <div className="hidden lg:flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                title="ขยายแถบด้านซ้าย"
                className="rounded px-3 py-1 text-gold-400 hover:bg-white/10"
                onClick={() => setSidebarCollapsed(false)}
              >
                »
              </button>
              <span className="text-xs text-military-300 [writing-mode:vertical-rl]">
                {showHospitals ? 'โรงพยาบาล' : 'เลือกคำสั่ง'}
              </span>
            </div>
            <div className="h-full lg:hidden">{fullNav}</div>
          </>
        ) : (
          fullNav
        )}
      </aside>
    </>
  )
}
