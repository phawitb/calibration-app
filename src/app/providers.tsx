'use client'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ImpersonationProvider } from '@/components/ImpersonationProvider'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import { OrderWorkspaceProvider } from '@/components/OrderWorkspace'
import { HospitalWorkspaceProvider } from '@/components/HospitalWorkspace'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ImpersonationProvider>
        <OrderWorkspaceProvider><HospitalWorkspaceProvider>
          <ImpersonationBanner />
          {children}
          <Toaster position="top-right" />
        </HospitalWorkspaceProvider></OrderWorkspaceProvider>
      </ImpersonationProvider>
    </SessionProvider>
  )
}
