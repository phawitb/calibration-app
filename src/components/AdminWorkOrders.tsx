'use client'
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import WorkOrderForm from './WorkOrderForm'
import type { WorkOrderSummary } from '@/lib/workOrderTypes'
export default function AdminWorkOrders() {
  const [orders, setOrders] = useState<WorkOrderSummary[]>([]),
    [query, setQuery] = useState(''),
    [editing, setEditing] = useState<WorkOrderSummary | null | undefined>(
      undefined
    ),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/orders'),
        j = await r.json()
      if (!r.ok) throw Error(j.error)
      setOrders(j.data)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  async function remove(order: WorkOrderSummary) {
    if (!confirm(`ลบคำสั่ง ${order.orderNo} และไฟล์แนบ?`)) return
    try {
      const r = await fetch(`/api/orders/${order._id}`, { method: 'DELETE' }),
        j = await r.json()
      if (!r.ok) throw Error(j.error)
      toast.success('ลบคำสั่งแล้ว')
      load()
      window.dispatchEvent(new Event('orders-changed'))
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  if (editing !== undefined)
    return (
      <WorkOrderForm
        key={editing?._id || 'new'}
        order={editing}
        onSaved={() => {
          setEditing(undefined)
          load()
          window.dispatchEvent(new Event('orders-changed'))
        }}
        onCancel={() => {
          setEditing(undefined)
          load()
        }}
      />
    )
  const filtered = orders.filter((o) =>
    `${o.orderNo} ${o.title} ${o.hospitals.map((h) => h.unitName).join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">คำสั่งปฏิบัติงาน</h2>
          <p className="text-sm text-gray-500">
            จัดการ รพ. เครื่องมือ ทีมผู้ปฏิบัติงาน และเอกสารคำสั่ง
          </p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(null)}>
          + เพิ่มคำสั่ง
        </button>
      </div>
      <input
        className="input-field"
        aria-label="ค้นหาคำสั่ง"
        placeholder="ค้นหาเลขที่คำสั่ง / ชื่อเรื่อง / โรงพยาบาล"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {error} <button onClick={load}>ลองใหม่</button>
        </p>
      )}
      {loading ? (
        <p className="text-gray-500 py-8">กำลังโหลดคำสั่ง…</p>
      ) : !filtered.length ? (
        <div className="card py-12 text-center text-gray-500">
          {query
            ? 'ไม่พบคำสั่งที่ค้นหา'
            : 'ยังไม่มีคำสั่ง เริ่มด้วยปุ่ม “เพิ่มคำสั่ง”'}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((o) => (
            <article key={o._id} className="card space-y-3">
              <div>
                <p className="text-xs text-military-600">
                  คำสั่งที่ {o.orderNo}
                </p>
                <h3 className="font-semibold text-lg break-words">{o.title}</h3>
                <p className="text-sm text-gray-500">
                  {o.startDate} – {o.endDate}
                </p>
              </div>
              <p className="text-sm">
                {o.hospitals.length} รพ. · {o.devices.length} เครื่องมือ ·{' '}
                {o.members.length} คน
              </p>
              <p className="text-sm text-gray-600 break-words">
                {o.hospitals.map((h) => h.unitName).join(' · ')}
              </p>
              <p className="text-sm text-gray-600">
                ทีม:{' '}
                {o.members.map((m) => `${m.name} (${m.username})`).join(', ')}
              </p>
              <div className="flex gap-4 border-t pt-3 text-sm">
                <button
                  className="font-medium text-military-800"
                  onClick={() => setEditing(o)}
                >
                  แก้ไข / จัดการ PDF
                </button>
                <button className="text-red-600" onClick={() => remove(o)}>
                  ลบคำสั่ง
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
