'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { useOrderWorkspace } from './OrderWorkspace'
import { useHospitalWorkspace } from './HospitalWorkspace'
import HospitalSidebar from '@/components/HospitalSidebar'
import PageFeedback, { FeedbackProvider } from './PageFeedback'
import { Suspense } from 'react'
import Navbar from '@/components/Navbar'

export default function AppShell({
  children,
  contentClassName = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6',
}: {
  children: React.ReactNode
  contentClassName?: string
}) {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const isHospitalUser = role === 'hospital_user'
  const { selectedOrder, loading } = useOrderWorkspace()
  const {
    selectedHospital,
    loading: hospitalsLoading,
  } = useHospitalWorkspace()
  const pathname = usePathname()
  const isNewRecord = pathname === '/records/new'
  const requiresOrder = pathname === '/records/new' || pathname === '/hospital'
  return (
    <FeedbackProvider><div className="min-h-screen bg-military-50 flex">
      {role && !isHospitalUser && <HospitalSidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar />
        <main className={`flex-1 w-full ${isHospitalUser ? contentClassName.replace('max-w-7xl', 'max-w-none') : contentClassName}`}>
          {requiresOrder &&
          (loading || (!!selectedOrder && hospitalsLoading)) ? (
            <p className="py-12 text-center">กำลังโหลดคำสั่ง…</p>
          ) : requiresOrder &&
            (!selectedOrder || (isNewRecord && !selectedHospital)) ? (
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-military-900">
                {isNewRecord ? 'เพิ่มข้อมูลสอบเทียบ' : 'โรงพยาบาลและเครื่องมือ'}
              </h1>
              <div role="status" className="card py-12 text-center">
                <h2 className="text-lg font-semibold">
                  {!selectedOrder
                    ? 'กรุณาเลือกคำสั่งและโรงพยาบาลก่อนเพิ่มข้อมูลสอบเทียบ'
                    : 'กรุณาเลือกโรงพยาบาลก่อนเพิ่มข้อมูลสอบเทียบ'}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {!selectedOrder
                    ? 'เลือกคำสั่งจากแถบด้านซ้าย แล้วเลือกโรงพยาบาลในคำสั่ง'
                    : 'เลือกโรงพยาบาลจากแถบด้านซ้ายเพื่อเริ่มกรอกข้อมูล'}
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
      <Suspense fallback={null}><PageFeedback /></Suspense>
    </div></FeedbackProvider>
  )
}
