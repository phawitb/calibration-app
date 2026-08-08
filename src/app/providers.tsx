'use client'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ImpersonationProvider } from '@/components/ImpersonationProvider'
import ImpersonationBanner from '@/components/ImpersonationBanner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ImpersonationProvider>
        <ImpersonationBanner />
        {children}
        <Toaster position="top-right" />
      </ImpersonationProvider>
    </SessionProvider>
  )
}
