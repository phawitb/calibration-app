'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { SiteLogoHeader } from '@/components/SiteLogo'
import { useEffect, useMemo, useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const role = (session?.user as any)?.role as string | undefined
  const canApprove = role === 'admin' || role === 'approver'
  const canSeeRecalibrationAlerts = role === 'admin' || role === 'approver' || role === 'technician'
  const canManageUsers = role === 'admin'
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
  const links = [
    { href: '/dashboard', label: 'หน้าหลัก', icon: '🏠' },
    { href: '/records', label: 'ข้อมูลสอบเทียบ', icon: '📋' },
    ...(isHospitalUser ? [{ href: '/hospital', label: 'เครื่องมือของหน่วย', icon: '🏥' }] : []),
    ...(canAddRecord ? [{ href: '/records/new', label: 'เพิ่มข้อมูล', icon: '➕' }] : []),
    ...(canApprove ? [{ href: '/approvals', label: 'งานรออนุมัติ', icon: '✅' }] : []),
    ...(canManageUsers ? [{ href: '/admin', label: 'จัดการระบบ', icon: '⚙️' }] : []),
  ]

  return (
    <nav className="bg-military-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <SiteLogoHeader />

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {links.map(link => (
              <Link key={link.href} href={link.href}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  (link.href === '/records/new'
                    ? pathname === '/records/new'
                    : link.href === '/records'
                    ? pathname.startsWith('/records') && pathname !== '/records/new'
                    : pathname.startsWith(link.href))
                    ? 'bg-military-600 text-white'
                    : 'text-military-200 hover:bg-military-700 hover:text-white'
                }`}>
                <span className="sm:hidden">{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-2">
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
              <p className="text-xs text-military-200">{(session?.user as any)?.fullName || session?.user?.name}</p>
              <p className="text-xs text-gold-400">{roleText}</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="w-9 h-9 rounded-full bg-military-700 hover:bg-military-600 flex items-center justify-center text-white"
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
                  <Link href="/profile" onClick={() => setProfileOpen(false)} className="block px-3 py-2 text-sm hover:bg-gray-50">
                    โปรไฟล์ของฉัน
                  </Link>
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
      </div>
    </nav>
  )
}
