'use client'

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface ImpersonationContextValue {
  /** Whether currently impersonating */
  isImpersonating: boolean
  /** Start impersonating a user */
  startImpersonation: (userId: string) => Promise<void>
  /** Stop impersonating */
  stopImpersonation: () => Promise<void>
  /** Whether the real (original) user is admin */
  isRealAdmin: boolean
}

const ImpersonationContext = createContext<ImpersonationContextValue>({
  isImpersonating: false,
  startImpersonation: async () => {},
  stopImpersonation: async () => {},
  isRealAdmin: false,
})

export function useImpersonation() {
  return useContext(ImpersonationContext)
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { data: session, update } = useSession()
  const router = useRouter()

  const user = session?.user as Record<string, any> | undefined
  const isImpersonating = !!(user?._isImpersonating)
  // Real admin = currently admin OR impersonating (which means original user was admin)
  const isRealAdmin = user?.role === 'admin' || isImpersonating

  const startImpersonation = useCallback(async (userId: string) => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    if (!res.ok) return
    // Force session refresh so NextAuth picks up the cookie
    await update()
    router.push('/dashboard')
    router.refresh()
  }, [router, update])

  const stopImpersonation = useCallback(async () => {
    await fetch('/api/admin/impersonate', { method: 'DELETE' })
    await update()
    router.push('/admin')
    router.refresh()
  }, [router, update])

  return (
    <ImpersonationContext.Provider
      value={{ isImpersonating, startImpersonation, stopImpersonation, isRealAdmin }}
    >
      {children}
    </ImpersonationContext.Provider>
  )
}
