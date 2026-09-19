'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useSession } from 'next-auth/react'
import { orderStorageKey, selectedVisibleOrder } from '@/lib/workspaceOrder'
import { writeWorkspaceHospitalCookie } from '@/lib/workspaceHospital'
import type { WorkOrderSummary } from '@/lib/workOrderTypes'
type Value = {
  orders: WorkOrderSummary[]
  selectedOrder: WorkOrderSummary | null
  selectOrder: (id: string) => void
  loading: boolean
  error: string
  refreshOrders: () => Promise<void>
}
const Context = createContext<Value | null>(null)
export function OrderWorkspaceProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession(),
    user = session?.user as any
  const identity = user
    ? `${user.id}:${user.role}:${user.hospitalUnit || ''}`
    : ''
  const [state, setState] = useState({
      identity: '',
      orders: [] as WorkOrderSummary[],
      id: '',
      loading: true,
      error: '',
    }),
    [generation, setGeneration] = useState(0)
  const refreshOrders = useCallback(async () => {
    setGeneration((n) => n + 1)
  }, [])
  useEffect(() => {
    if (status === 'loading') return
    if (!identity) {
      setState({ identity: '', orders: [], id: '', loading: false, error: '' })
      writeWorkspaceHospitalCookie('')
      return
    }
    const controller = new AbortController()
    setState((prev) => ({ ...prev, loading: true, error: '' }))
    fetch('/api/orders', { signal: controller.signal })
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok) throw Error(j.error)
        let id = ''
        try {
          id = localStorage.getItem(orderStorageKey(identity)) || ''
        } catch {}
        const selected = selectedVisibleOrder(j.data, id)
        setState({
          identity,
          orders: j.data,
          id: selected?._id || '',
          loading: false,
          error: '',
        })
        if (!selected) writeWorkspaceHospitalCookie('')
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setState({
            identity,
            orders: [],
            id: '',
            loading: false,
            error: e.message,
          })
      })
    return () => controller.abort()
  }, [identity, status, generation])
  useEffect(() => {
    const refresh = () => refreshOrders()
    window.addEventListener('focus', refresh)
    window.addEventListener('orders-changed', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('orders-changed', refresh)
    }
  }, [refreshOrders])
  const selectOrder = useCallback(
    (id: string) => {
      if (state.identity !== identity) return
      const selected = selectedVisibleOrder(state.orders, id)
      writeWorkspaceHospitalCookie('')
      try {
        if (selected)
          localStorage.setItem(orderStorageKey(identity), selected._id)
        else localStorage.removeItem(orderStorageKey(identity))
      } catch {}
      setState((prev) => ({ ...prev, id: selected?._id || '' }))
    },
    [identity, state.identity, state.orders]
  )
  const value = useMemo(
    () => ({
      orders: state.identity === identity ? state.orders : [],
      selectedOrder:
        state.identity === identity
          ? selectedVisibleOrder(state.orders, state.id)
          : null,
      selectOrder,
      loading:
        status === 'loading' || state.loading || state.identity !== identity,
      error: state.error,
      refreshOrders,
    }),
    [state, identity, status, selectOrder, refreshOrders]
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useOrderWorkspace() {
  const value = useContext(Context)
  if (!value) throw Error('Order workspace unavailable')
  return value
}
