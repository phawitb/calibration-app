'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useOrderWorkspace} from './OrderWorkspace'
import HospitalSidebar from '@/components/HospitalSidebar'
import Navbar from '@/components/Navbar'

export default function AppShell({
  children,
  contentClassName = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
}: {
  children: React.ReactNode
  contentClassName?: string
}) {
  const {selectedOrder,loading}=useOrderWorkspace()
  const pathname=usePathname()
  const requiresOrder=pathname==='/dashboard'||pathname==='/hospital'||pathname==='/records/new'
  return (
    <div className="min-h-screen bg-military-50 flex">
      {pathname !== '/orders' && <HospitalSidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar />
        <main className={`flex-1 w-full ${contentClassName}`}>
          {requiresOrder && loading ? <p className="py-12 text-center">กำลังโหลดคำสั่ง…</p> : requiresOrder && !selectedOrder ? <div className="card py-12 text-center"><h1 className="text-xl font-semibold">เลือกคำสั่งก่อนเริ่มงาน</h1><Link href="/orders" className="btn-primary inline-block mt-4">ไปเลือกคำสั่ง</Link></div> : children}
        </main>
      </div>
    </div>
  )
}
