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
import { useRouter } from 'next/navigation'
import { orderStorageKey, selectedVisibleOrder } from '@/lib/workspaceOrder'
import { writeWorkspaceHospitalCookie } from '@/lib/workspaceHospital'
import type { WorkOrderSummary } from '@/lib/workOrderTypes'
type Value = {
  orders: WorkOrderSummary[]
  selectedOrder: WorkOrderSummary | null
  allOrdersSelected: boolean
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
  const router = useRouter()
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
          id = localStorage.getItem(orderStorageKey(identity)) || 'all'
        } catch {}
        const selected = selectedVisibleOrder(j.data, id)
        setState({
          identity,
          orders: j.data,
          id: id === 'all' ? 'all' : selected?._id || '',
          loading: false,
          error: '',
        })
        if (!selected && id !== 'all') writeWorkspaceHospitalCookie('')
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
    window.addEventListener('orders-changed', refresh)
    return () => {
      window.removeEventListener('orders-changed', refresh)
    }
  }, [refreshOrders])
  const selectOrder = useCallback(
    (id: string) => {
      if (state.identity !== identity) return
      const selected = selectedVisibleOrder(state.orders, id)
      writeWorkspaceHospitalCookie('')
      try {
        if (id === 'all') localStorage.setItem(orderStorageKey(identity), 'all')
        else if (selected)
          localStorage.setItem(orderStorageKey(identity), selected._id)
        else localStorage.removeItem(orderStorageKey(identity))
      } catch {}
      setState((prev) => ({
        ...prev,
        id: id === 'all' ? 'all' : selected?._id || '',
      }))
      router.refresh()
    },
    [identity, state.identity, state.orders, router]
  )
  const value = useMemo(
    () => ({
      orders: state.identity === identity ? state.orders : [],
      selectedOrder:
        state.identity === identity
          ? selectedVisibleOrder(state.orders, state.id)
          : null,
      allOrdersSelected: state.identity === identity && state.id === 'all',
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
