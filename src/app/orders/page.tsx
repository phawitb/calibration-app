'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useOrderWorkspace } from '@/components/OrderWorkspace'
import WorkOrderDocuments from '@/components/WorkOrderDocuments'
import { canManageOrders } from '@/lib/workOrderValidation'
export default function OrdersPage() {
  const {
      orders,
      selectedOrder,
      allOrdersSelected,
      selectOrder,
      loading,
      error,
      refreshOrders,
    } = useOrderWorkspace(),
    router = useRouter(),
    { data: session } = useSession()
  const [query, setQuery] = useState(''),
    [expanded, setExpanded] = useState('')
  const role = (session?.user as any)?.role
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-military-500">
            พื้นที่ปฏิบัติงาน
          </p>
          <h1 className="text-2xl font-bold text-military-900">
            เลือกคำสั่งปฏิบัติงาน
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            เลือกคำสั่ง แล้วเลือกโรงพยาบาลเพื่อเริ่มงานสอบเทียบ
          </p>
        </div>
        {canManageOrders(role) && (
          <Link href="/admin?tab=data&category=orders" className="btn-primary">
            จัดการคำสั่ง
          </Link>
        )}
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
          {error} <button onClick={refreshOrders}>ลองใหม่</button>
        </p>
      )}
      {loading ? (
        <p className="py-8 text-gray-500">กำลังโหลดคำสั่ง…</p>
      ) : !orders.length ? (
        <div className="card py-16 text-center">
          <h2 className="font-semibold">ยังไม่มีคำสั่งปฏิบัติงาน</h2>
          <p className="mt-2 text-sm text-gray-500">
            {canManageOrders(role)
              ? 'เพิ่มคำสั่งในหน้าจัดการระบบเพื่อเริ่มใช้งาน'
              : 'รอผู้ดูแลระบบหรือ จนท.สอบเทียบเพิ่มคำสั่ง'}
          </p>
          <Link href="/records" className="mt-4 inline-block text-sm underline">
            ดูประวัติสอบเทียบเดิม
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders
            .filter(
              (o) =>
                !selectedOrder ||
                allOrdersSelected ||
                o._id === selectedOrder._id
            )
            .filter((o) =>
              `${o.orderNo} ${o.title} ${o.hospitals.map((h) => h.unitName).join(' ')}`
                .toLowerCase()
                .includes(query.toLowerCase())
            )
            .map((o) => (
              <article key={o._id} className="card space-y-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="text-sm text-military-600">
                      คำสั่งที่ {o.orderNo}
                    </p>
                    <h2 className="text-xl font-semibold">{o.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {o.startDate} – {o.endDate}
                    </p>
                  </div>
                  <button
                    className="btn-primary self-start"
                    onClick={() => {
                      selectOrder(o._id)
                      router.push('/hospital')
                      router.refresh()
                    }}
                  >
                    เลือกคำสั่ง →
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-military-100 px-3 py-1">
                    {o.hospitals.length} โรงพยาบาล
                  </span>
                  <span className="rounded-full bg-military-100 px-3 py-1">
                    {o.devices.length} เครื่องมือ
                  </span>
                  <span className="rounded-full bg-military-100 px-3 py-1">
                    {o.members.length} ผู้ปฏิบัติงาน
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {o.hospitals.map((h) => h.unitName).join(' · ')}
                </p>
                <button
                  className="text-sm font-medium text-military-700 underline"
                  onClick={() => setExpanded(expanded === o._id ? '' : o._id)}
                >
                  {expanded === o._id
                    ? 'ซ่อนรายละเอียด'
                    : 'ดูเครื่องมือ ทีม และเอกสาร'}
                </button>
                {expanded === o._id && (
                  <div className="border-t pt-4 space-y-5">
                    <div>
                      <h3 className="font-semibold">ทีมผู้ปฏิบัติงาน</h3>
                      <p className="text-sm mt-2">
                        {o.members
                          .map((m) => `${m.name} (${m.username})`)
                          .join(', ')}
                      </p>
                    </div>
                    {o.hospitals.map((h) => (
                      <div key={h.unitName}>
                        <h3 className="font-semibold text-sm">{h.unitName}</h3>
                        <ul className="mt-2 space-y-1 text-sm text-gray-600">
                          {o.devices
                            .filter((d) => h.deviceIds.includes(d._id))
                            .map((d) => (
                              <li key={d._id}>
                                {d.deviceName} · AmedNo {d.amedNo} ·{' '}
                                {d.model || '-'} · S/N {d.serialNo || '-'}
                              </li>
                            ))}
                        </ul>
                      </div>
                    ))}
                    {o.notes && (
                      <p className="text-sm whitespace-pre-wrap">{o.notes}</p>
                    )}
                    {role !== 'hospital_user' && (
                      <WorkOrderDocuments orderId={o._id} />
                    )}
                  </div>
                )}
              </article>
            ))}
        </div>
      )}
    </div>
  )
}
