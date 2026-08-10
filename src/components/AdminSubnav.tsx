'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const TABS = [
  { href: '/admin?tab=users', label: 'จัดการผู้ใช้', tab: 'users' },
  { href: '/admin?tab=data', label: 'จัดการข้อมูล', tab: 'data' },
  { href: '/admin?tab=cert', label: 'จัดการรูปแบบเลขใบรับรอง', tab: 'cert' },
  { href: '/admin?tab=formulas', label: 'จัดการสูตรการคำนวณ', tab: 'formulas' },
  { href: '/admin?tab=iso-methods', label: 'วิธีการ ISO', tab: 'iso-methods' },
] as const

export default function AdminSubnav({ canManageUsers }: { canManageUsers: boolean }) {
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || (canManageUsers ? 'users' : 'data')
  return (
    <div className="flex flex-wrap gap-1 border-b border-military-200 mb-6" role="tablist" aria-label="เมนูผู้ดูแล">
      {TABS.filter((t) => canManageUsers || t.tab !== 'users').map((t) => {
        const active = currentTab === t.tab
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              active
                ? 'bg-military-800 text-white'
                : 'text-military-700 hover:bg-military-100'
            }`}
            role="tab"
            aria-selected={active}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
