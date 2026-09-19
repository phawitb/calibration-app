'use client'
import {resolveWorkspaceHospitals} from '@/lib/workspaceOrder'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useOrderWorkspace } from './OrderWorkspace'
import { usePathname, useRouter } from 'next/navigation'
import { buildHospitalUnitOptions, type UnitRefLike } from '@/lib/hospitalUnit'
import {
  readWorkspaceHospitalClient,
  WORKSPACE_SIDEBAR_STORAGE,
  writeWorkspaceHospitalCookie,
} from '@/lib/workspaceHospital'

type HospitalWorkspaceValue = {
  hospitals: string[]
  selectedHospital: string
  setSelectedHospital: (hospital: string) => void
  loading: boolean
  locked: boolean
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
}

const HospitalWorkspaceContext = createContext<HospitalWorkspaceValue | null>(null)

export function HospitalWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const {selectedOrder, loading:orderLoading} = useOrderWorkspace()
  const historical = pathname === '/records' || pathname === '/reports'
  const orderKey = selectedOrder?._id || ''
  const role = (session?.user as any)?.role as string | undefined
  const hospitalUnit = String((session?.user as any)?.hospitalUnit || '')
  const locked = role === 'hospital_user'
  const hydratedRef = useRef(false)

  const [hospitals, setHospitals] = useState<string[]>([])
  const [selectedHospital, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(WORKSPACE_SIDEBAR_STORAGE) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setCollapsed(collapsed)
    try {
      localStorage.setItem(WORKSPACE_SIDEBAR_STORAGE, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      if (status === 'unauthenticated') setLoading(false)
      return
    }
    if (orderLoading) { setLoading(true); return }
    if (!selectedOrder && !historical) { setHospitals([]); setSelected(''); writeWorkspaceHospitalCookie(''); setLoading(false); return }
    setLoading(true)
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/reference?type=units')
        const json = res.ok ? await res.json() : { data: [] }
        const options = resolveWorkspaceHospitals({historical,locked,hospitalUnit,allHospitals:buildHospitalUnitOptions((json.data || []) as UnitRefLike[]),orderHospitals:selectedOrder?.hospitals.map(h=>h.unitName)||[]})
        if (!mounted) return
        if (locked && hospitalUnit) {
          setHospitals(options)
          setSelected(options[0] || hospitalUnit)
          writeWorkspaceHospitalCookie(options[0] || hospitalUnit)
          if (!hydratedRef.current) {
            hydratedRef.current = true
            router.refresh()
          }
        } else {
          setHospitals(options)
          const stored = readWorkspaceHospitalClient()
          const next = options.includes(stored) ? stored : ''
          setSelected(next)
          writeWorkspaceHospitalCookie(next)
          if (next && !hydratedRef.current) {
            hydratedRef.current = true
            router.refresh()
          }
        }
      } catch {
        if (mounted) {setHospitals([]);setSelected('')}
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [status, locked, hospitalUnit, orderKey, selectedOrder, orderLoading, historical])

  const setSelectedHospital = useCallback((hospital: string) => {
    if (locked || !hospitals.includes(hospital)) return
    setSelected(hospital)
    writeWorkspaceHospitalCookie(hospital)
    setSidebarOpen(false)
    router.refresh()
  }, [locked, router, hospitals])

  const value = useMemo<HospitalWorkspaceValue>(() => ({
    hospitals,
    selectedHospital,
    setSelectedHospital,
    loading,
    locked,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  }), [
    hospitals,
    selectedHospital,
    setSelectedHospital,
    loading,
    locked,
    sidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  ])

  return (
    <HospitalWorkspaceContext.Provider value={value}>
      {children}
    </HospitalWorkspaceContext.Provider>
  )
}

export function useHospitalWorkspace() {
  const ctx = useContext(HospitalWorkspaceContext)
  if (!ctx) {
    throw new Error('useHospitalWorkspace must be used within HospitalWorkspaceProvider')
  }
  return ctx
}
