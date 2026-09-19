'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { navigationSection } from '@/lib/appNavigation'
export default function SectionNavigation() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const section = navigationSection(pathname)
  const links =
    section === 'calibration'
      ? [
          {
            href: '/records',
            label: 'รายการและประวัติสอบเทียบ',
            disabled: false,
          },
          ...(['admin', 'approver'].includes(role)
            ? [{ href: '/approvals', label: 'งานรออนุมัติ', disabled: false }]
            : []),
        ]
      : []
  if (!links.length) return null
  return (
    <nav
      aria-label="เมนูย่อย"
      className="mb-5 flex flex-wrap gap-2 print:hidden"
    >
      {links.map((link) =>
        link.disabled ? (
          <span
            key={link.href}
            aria-disabled="true"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-400"
          >
            {link.label}
          </span>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${pathname === link.href ? 'border-military-700 bg-military-800 text-white' : 'border-military-200 bg-white text-military-700 hover:bg-military-50'}`}
          >
            {link.label}
          </Link>
        )
      )}
    </nav>
  )
}
