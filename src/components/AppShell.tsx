'use client'

import HospitalSidebar from '@/components/HospitalSidebar'
import Navbar from '@/components/Navbar'

export default function AppShell({
  children,
  contentClassName = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
}: {
  children: React.ReactNode
  contentClassName?: string
}) {
  return (
    <div className="min-h-screen bg-military-50 flex">
      <HospitalSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar />
        <main className={`flex-1 w-full ${contentClassName}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
