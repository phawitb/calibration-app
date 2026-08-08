'use client'

import { useSession } from 'next-auth/react'
import { useImpersonation } from './ImpersonationProvider'

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  approver: 'ผู้อนุมัติ',
  technician: 'จนท.สอบเทียบ',
  hospital_user: 'ผู้ใช้ รพ.',
}

export default function ImpersonationBanner() {
  const { data: session } = useSession()
  const { isImpersonating, stopImpersonation } = useImpersonation()

  if (!isImpersonating) return null

  const user = session?.user as Record<string, any> | undefined

  return (
    <div className="bg-amber-400 text-gray-900 px-4 py-2 text-sm flex items-center justify-between z-50 sticky top-0">
      <div className="flex items-center gap-2">
        <span className="font-bold">สวมบทบาท:</span>
        <span>{user?.fullName || user?.name || user?.username}</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-600 text-white text-xs font-medium">
          {ROLE_LABELS[user?.role] || user?.role}
        </span>
        {user?.hospitalUnit && (
          <span className="text-amber-800 text-xs">({user.hospitalUnit})</span>
        )}
      </div>
      <button
        type="button"
        onClick={stopImpersonation}
        className="px-3 py-1 rounded bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
      >
        ออกจากการสวมบทบาท
      </button>
    </div>
  )
}
