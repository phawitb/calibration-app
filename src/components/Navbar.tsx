'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { SiteLogoHeader } from '@/components/SiteLogo'
import { useHospitalWorkspace } from '@/components/HospitalWorkspace'
import { displayHospitalName } from '@/lib/hospitalUnit'
import { useEffect, useMemo, useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { selectedHospital, setSidebarOpen } = useHospitalWorkspace()
  const role = (session?.user as any)?.role as string | undefined
  const canApprove = role === 'admin' || role === 'approver'
  const canSeeRecalibrationAlerts = role === 'admin' || role === 'approver' || role === 'technician'
  const canManageSystemData = role === 'admin' || role === 'technician'
  const canAddRecord = role === 'admin' || role === 'technician'
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [recalibrationAlertCount, setRecalibrationAlertCount] = useState<number | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const roleText = useMemo(() => {
    if (role === 'admin') return 'ผู้ดูแลระบบ'
    if (role === 'approver') return 'ผู้อนุมัติ'
    if (role === 'technician') return 'จนท.สอบเทียบ'
    if (role === 'hospital_user') return 'ผู้ใช้ รพ.'
    return 'ผู้ใช้งาน'
  }, [role])
  const hospitalLabel = selectedHospital ? displayHospitalName(selectedHospital).title : ''

  useEffect(() => {
    if (!canApprove) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/approvals/pending/count')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setPendingCount(Number.isFinite(json.count) ? Number(json.count) : 0)
      } catch {
        if (!cancelled) setPendingCount(null)
      }
    }
    load()
    const t = setInterval(load, 10000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [canApprove, pathname])

  useEffect(() => {
    if (!canSeeRecalibrationAlerts) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/alerts/recalibration/count')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setRecalibrationAlertCount(Number.isFinite(json.count) ? Number(json.count) : 0)
      } catch {
        if (!cancelled) setRecalibrationAlertCount(null)
      }
    }
    load()
    const t = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [canSeeRecalibrationAlerts, pathname])

  const isHospitalUser = role === 'hospital_user'
  const workspaceTabs = [
    { href: '/dashboard', label: 'หน้าหลัก', match: (p: string) => p.startsWith('/dashboard') },
    { href: '/hospital', label: 'ข้อมูลเครื่องมือแพทย์', match: (p: string) => p.startsWith('/hospital') },
    ...(canAddRecord ? [{ href: '/records/new', label: 'เพิ่มข้อมูลสอบเทียบ', match: (p: string) => p === '/records/new' }] : []),
    {
      href: '/records',
      label: 'ประวัติสอบเทียบ',
      match: (p: string) => p.startsWith('/records') && p !== '/records/new',
    },
  ]

  const utilityTabs = [
    ...(!isHospitalUser ? [{ href: '/reports', label: 'รายงานผล', match: (p: string) => p.startsWith('/reports') }] : []),
    ...(!isHospitalUser && canManageSystemData ? [{ href: '/admin?tab=data', label: 'จัดการระบบ', match: (p: string) => p.startsWith('/admin') }] : []),
  ]
  const profileLinks = [
    { href: '/profile', label: 'โปรไฟล์ของฉัน' },
    ...(!isHospitalUser ? [{ href: '/reports', label: 'รายงานผล' }] : []),
    ...(canApprove ? [{ href: '/approvals', label: 'งานรออนุมัติ' }] : []),
    ...(!isHospitalUser && canManageSystemData ? [{ href: '/admin?tab=data', label: 'จัดการระบบ' }] : []),
  ]

  const tabActive = (tab: { match: (p: string) => boolean }) => tab.match(pathname)

  return (
    <header className="bg-white/90 backdrop-blur border-b border-military-200 z-30 print:hidden">
      <div className="px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="lg:hidden h-9 w-9 rounded-lg border border-military-200 text-military-800 hover:bg-military-50"
              onClick={() => setSidebarOpen(true)}
              aria-label="เลือกโรงพยาบาล"
            >
              ☰
            </button>
            <SiteLogoHeader />
            {hospitalLabel && (
              <span className="hidden md:inline-flex max-w-[220px] truncate rounded-full bg-military-100 text-military-800 text-xs font-medium px-2.5 py-1">
                {hospitalLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canApprove && pendingCount != null && pendingCount > 0 && (
              <Link href="/approvals" className="hidden sm:inline-flex rounded-full bg-amber-400 text-gray-900 text-xs px-2 py-1 font-semibold">
                รออนุมัติ {pendingCount}
              </Link>
            )}
            {canSeeRecalibrationAlerts && recalibrationAlertCount != null && recalibrationAlertCount > 0 && (
              <Link href="/dashboard" className="hidden sm:inline-flex rounded-full bg-red-500 text-white text-xs px-2 py-1 font-semibold">
                ใกล้ครบอายุ {recalibrationAlertCount}
              </Link>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-600">{(session?.user as any)?.fullName || session?.user?.name}</p>
              <p className="text-xs text-gold-600">{roleText}</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-military-800 hover:bg-military-700 flex items-center justify-center text-white"
                title="โปรไฟล์"
              >
                👤
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-lg border border-gray-200 bg-white text-gray-700 shadow-lg z-40">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium">{(session?.user as any)?.fullName || session?.user?.name}</p>
                    <p className="text-xs text-gray-500">{roleText}</p>
                  </div>
                  {profileLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setProfileOpen(false)}
                      className="block px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
                  >
                    ออกจากระบบ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav className="flex items-end gap-1 overflow-x-auto -mb-px">
          {workspaceTabs.map((tab) => {
            const active = tabActive(tab)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm border-b-2 transition-colors ${
                  active
                    ? 'border-gold-500 text-military-900 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-military-800 hover:border-military-200'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
          {utilityTabs.length > 0 && (
            <div className="ml-auto flex items-end gap-1 pl-3">
              {utilityTabs.map((tab) => {
                const active = tabActive(tab)
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`whitespace-nowrap px-3 sm:px-4 py-2.5 text-sm border-b-2 transition-colors ${
                      active
                        ? 'border-gold-500 text-military-900 font-semibold'
                        : 'border-transparent text-gray-500 hover:text-military-800 hover:border-military-200'
                    }`}
                  >
                    {tab.label}
                  </Link>
                )
              })}
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
