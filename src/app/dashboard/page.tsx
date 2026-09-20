import { listOrders } from '@/lib/workOrderService'
import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { calcRecalibrationDates, getRecalibrationSettings } from '@/lib/recalibration'
import { getUnitVariants } from '@/lib/unitVariants'
import { decodeWorkspaceHospital, WORKSPACE_HOSPITAL_COOKIE } from '@/lib/workspaceHospital'
import { displayHospitalName } from '@/lib/hospitalUnit'
import SelectHospitalHint from '@/components/SelectHospitalHint'
import { withSavedRecords } from '@/lib/recordLifecycle'

function getDateRanges() {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startWeek = new Date(startToday)
  startWeek.setDate(startWeek.getDate() - 6)
  const startYear = new Date(now.getFullYear(), 0, 1)
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const months12Ago = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  return { now, startToday, startWeek, startYear, startMonth, months12Ago }
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function StatusLabel({ status }: { status?: string }) {
  const labels: Record<string, string> = {
    draft: 'ฉบับร่าง',
    rejected: 'ตีกลับให้แก้ไข',
    pending_approval: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
  }
  const tones: Record<string,string> = {draft:'bg-slate-100 text-slate-700',rejected:'bg-rose-50 text-rose-700',pending_approval:'bg-amber-50 text-amber-800',approved:'bg-emerald-50 text-emerald-700'}
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs whitespace-nowrap ${tones[status || ''] || 'bg-gray-100 text-gray-600'}`}>{labels[status || ''] || '-'}</span>
}

function WorkList({
  title,
  rows,
  emptyText,
  actionHref,
  actionText,
}: {
  title: string
  rows: any[]
  emptyText: string
  actionHref: string
  actionText: string
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-military-800">{title}</h2>
        <Link href={actionHref} className="text-military-600 text-sm hover:underline">{actionText} →</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-gray-500 font-medium">เครื่องมือ</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">เลขที่ใบรับรอง</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">สถานะ</th>
            <th className="text-left py-2 px-3 text-gray-500 font-medium">อัปเดต</th>
          </tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r._id} className="border-b border-gray-50 hover:bg-military-50">
                <td className="py-2 px-3 font-medium text-military-800"><Link href={`/records/${r._id}`} className="hover:underline">{r.deviceName || r.amedNo || '-'}<span className="block text-xs text-gray-500 font-normal mt-1">{r.amedNo || '—'}</span></Link></td>
                <td className="py-2 px-3 text-gray-600">{r.certNo || '-'}</td>
                <td className="py-2 px-3"><StatusLabel status={r.approvalStatus} /></td>
                <td className="py-2 px-3 text-gray-500 text-xs">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('th-TH') : '-'}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">{emptyText}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function getStats(orderId?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  const role = (session?.user as any)?.role
  const hospitalUnit = (session?.user as any)?.hospitalUnit
  const username = String((session?.user as any)?.username || '')
  const cookieHospital = decodeWorkspaceHospital(cookies().get(WORKSPACE_HOSPITAL_COOKIE)?.value)
  const scopeHospital = role === 'hospital_user' ? String(hospitalUnit || '') : cookieHospital
  const { now, startToday, startWeek, startYear, startMonth, months12Ago } = getDateRanges()

  if (role === 'hospital_user' && !scopeHospital) {
    return { needsHospital: true as const, session, role, scopeHospital: '' }
  }

  await connectDB()
  const orders = await listOrders(session.user as any)
  const selectedOrder = orderId ? orders.find(order=>order._id===orderId) : undefined
  if (orderId && !selectedOrder) notFound()
  const unitVariants = await getUnitVariants(scopeHospital)
  const scope: any = withSavedRecords(scopeHospital ? {
    unitName: { $in: unitVariants.length ? unitVariants : [scopeHospital] },
  } : {})
  if (selectedOrder) scope.workOrderId = selectedOrder._id
  const rejectedCount = await CalibrationRecord.countDocuments({...scope,approvalStatus:'rejected'})
  const [
    total,
    thisYear,
    thisWeek,
    thisMonth,
    todayAdded,
    pendingApproval,
    approvedCount,
    draftCount,
    pendingLong,
    hospitals,
  ] = await Promise.all([
    CalibrationRecord.countDocuments(scope),
    CalibrationRecord.countDocuments({
      ...scope,
      calDate: { $gte: startYear },
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      createdAt: { $gte: startWeek },
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      createdAt: { $gte: startMonth },
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      createdAt: { $gte: startToday },
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'pending_approval',
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'approved',
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'draft',
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'pending_approval',
      updatedAt: { $lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    }),
    CalibrationRecord.distinct('unitName', scope).then((rows) => rows.length),
  ])

  const { certValidityMonths, alertBeforeDays } = await getRecalibrationSettings()
  const { dueBoundary, expiringStart, expiringEnd } = calcRecalibrationDates(
    now,
    certValidityMonths,
    alertBeforeDays
  )
  const [expiringSoon, overdueRecalibration] = await Promise.all([
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'approved',
      calDate: { $gte: expiringStart, $lte: expiringEnd },
    }),
    CalibrationRecord.countDocuments({
      ...scope,
      approvalStatus: 'approved',
      calDate: { $lte: dueBoundary },
    }),
  ])
  const costSummaryRows = await CalibrationRecord.aggregate([
    {
      $match: {
        ...scope,
        approvalStatus: 'approved',
      },
    },
    {
      $group: {
        _id: null,
        calPriceTotal: { $sum: { $ifNull: ['$calPrice', 0] } },
        mainPriceTotal: { $sum: { $ifNull: ['$mainPrice', 0] } },
      },
    },
  ])
  const calPriceTotal = Number((costSummaryRows?.[0] as any)?.calPriceTotal || 0)
  const mainPriceTotal = Number((costSummaryRows?.[0] as any)?.mainPriceTotal || 0)

  const technicianOwnScope =
    role === 'technician'
      ? {
          $or: [
            { createdBy: username },
            { calibratedById: String((session?.user as any)?.id || '') },
          ],
        }
      : null

  const [myDraft, myPending] = technicianOwnScope
    ? await Promise.all([
        CalibrationRecord.countDocuments({
          ...scope,
          ...technicianOwnScope,
          approvalStatus: 'draft',
        }),
        CalibrationRecord.countDocuments({
          ...scope,
          ...technicianOwnScope,
          approvalStatus: 'pending_approval',
        }),
      ])
    : [0, 0]

  const approverQueuePromise =
    role === 'approver'
      ? CalibrationRecord.countDocuments({
          ...scope,
          approvalStatus: 'pending_approval',
          requestedApproverId: String((session?.user as any)?.id || ''),
        })
      : Promise.resolve(0)

  const pendingListScope: any = { ...scope, approvalStatus: 'pending_approval' }
  if (role === 'approver') {
    pendingListScope.requestedApproverId = String((session?.user as any)?.id || '')
  }

  const workListScope: any = role === 'approver'
    ? { ...scope, approvalStatus: 'pending_approval', requestedApproverId: String((session?.user as any)?.id || '') }
    : role === 'technician'
      ? { ...scope, ...technicianOwnScope, approvalStatus: { $in: ['draft', 'rejected', 'pending_approval'] } }
      : role === 'hospital_user'
        ? { ...scope, approvalStatus: 'approved' }
        : { ...scope, approvalStatus: { $in: ['draft','rejected','pending_approval'] } }

  const [approverQueue, recent, thisWeekRecent, pendingList, workList, expiringSoonList, overdueList] =
    await Promise.all([
      approverQueuePromise,
      CalibrationRecord.find()
        .where(scope)
        .select('deviceName certNo calDate unitName lapTemp lapHumid approvalStatus requestedApproverName amedNo updatedAt')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean(),
      CalibrationRecord.find({
        ...scope,
        createdAt: { $gte: startWeek },
      })
        .select('deviceName certNo calDate unitName approvalStatus')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      CalibrationRecord.find(pendingListScope)
        .select('deviceName certNo calDate unitName requestedApproverName updatedAt amedNo')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      CalibrationRecord.find(workListScope)
        .select('deviceName certNo calDate unitName approvalStatus rejectionComment updatedAt amedNo')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .lean(),
      CalibrationRecord.find({
        ...scope,
        approvalStatus: 'approved',
        calDate: { $gte: expiringStart, $lte: expiringEnd },
      })
        .select('amedNo certNo deviceName calDate unitName')
        .sort({ calDate: 1 })
        .limit(8)
        .lean(),
      CalibrationRecord.find({
        ...scope,
        approvalStatus: 'approved',
        calDate: { $lte: dueBoundary },
      })
        .select('amedNo certNo deviceName calDate unitName')
        .sort({ calDate: 1 })
        .limit(8)
        .lean(),
    ])

  const weekStartNow = getWeekStart(new Date())
  const weekStarts: Date[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(weekStartNow)
    d.setDate(d.getDate() - i * 7)
    weekStarts.push(d)
  }
  const trendStart = weekStarts[0]
  const [trendRows, monthlyRows, topUnits, topCreatedBy, topRecalibration] = await Promise.all([
    CalibrationRecord.find({
      ...scope,
      createdAt: { $gte: trendStart },
    })
      .select('createdAt')
      .lean(),
    CalibrationRecord.find({
      ...scope,
      createdAt: { $gte: months12Ago },
    })
      .select('createdAt')
      .lean(),
    CalibrationRecord.aggregate([
      { $match: scope },
      { $group: { _id: '$unitName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    CalibrationRecord.aggregate([
      { $match: scope },
      {
        $group: {
          _id: '$createdBy',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    CalibrationRecord.aggregate([
      { $match: scope },
      {
        $group: {
          _id: '$amedNo',
          count: { $sum: 1 },
          latestCertNo: { $first: '$certNo' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ])
  const trendMap = new Map<string, number>()
  for (const ws of weekStarts) trendMap.set(ws.toISOString().slice(0, 10), 0)
  for (const r of trendRows as any[]) {
    const dt = new Date(r?.createdAt || 0)
    if (Number.isNaN(dt.getTime())) continue
    const ws = getWeekStart(dt).toISOString().slice(0, 10)
    if (trendMap.has(ws)) trendMap.set(ws, (trendMap.get(ws) || 0) + 1)
  }
  const weeklyTrend = weekStarts.map((ws) => {
    const key = ws.toISOString().slice(0, 10)
    return {
      key,
      label: `${String(ws.getDate()).padStart(2, '0')}/${String(ws.getMonth() + 1).padStart(2, '0')}`,
      count: trendMap.get(key) || 0,
    }
  })

  const monthKeys: string[] = []
  const monthMap = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthKeys.push(key)
    monthMap.set(key, 0)
  }
  for (const r of monthlyRows as any[]) {
    const d = new Date(r?.createdAt || 0)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1)
  }
  const monthlyTrend = monthKeys.map((key) => {
    const [y, m] = key.split('-')
    return { key, label: `${m}/${String(Number(y)+543).slice(-2)}`, count: monthMap.get(key) || 0 }
  })

  const usernames = topCreatedBy.map((x: any) => String(x._id || '')).filter(Boolean)
  const userRows = usernames.length
    ? await User.find({ username: { $in: usernames } })
        .select('username fullName fullNameEn rank rankEn')
        .lean()
    : []
  const userMap = new Map(
    (userRows as any[]).map((u) => [
      String(u.username || ''),
      String(
        `${u.rankEn || u.rank || ''} ${u.fullNameEn || u.fullName || u.username || ''}`
      ).trim(),
    ])
  )
  const topTechnicians = topCreatedBy.map((row: any) => ({
    username: String(row._id || ''),
    name: userMap.get(String(row._id || '')) || String(row._id || '-'),
    count: Number(row.count || 0),
  }))

  return {
    orders, selectedOrder, rejectedCount,
    total,
    thisYear,
    thisMonth,
    thisWeek,
    todayAdded,
    pendingApproval,
    approvedCount,
    draftCount,
    pendingLong,
    expiringSoon,
    overdueRecalibration,
    hospitals,
    myDraft,
    myPending,
    approverQueue,
    recent,
    thisWeekRecent,
    pendingList,
    workList,
    weeklyTrend,
    monthlyTrend,
    expiringSoonList,
    overdueList,
    topUnits: topUnits.map((u: any) => ({ name: String(u._id || '-'), count: Number(u.count || 0) })),
    topTechnicians,
    topRecalibration: topRecalibration.map((r: any) => ({
      amedNo: String(r._id || '-'),
      count: Number(r.count || 0),
      latestCertNo: String(r.latestCertNo || '-'),
    })),
    certValidityMonths,
    alertBeforeDays,
    calPriceTotal,
    mainPriceTotal,
    session,
    role,
    needsHospital: false as const,
    scopeHospital,
  }
}

export default async function DashboardPage({searchParams}:{searchParams?:{order?:string}}) {
  const stats = await getStats(searchParams?.order)
  if (stats.needsHospital) return <SelectHospitalHint title="ยังไม่ได้กำหนดโรงพยาบาลให้บัญชีนี้" detail="กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดโรงพยาบาลก่อนดูข้อมูล" />
  const hospitalTitle = stats.scopeHospital ? (displayHospitalName(stats.scopeHospital).title || stats.scopeHospital) : 'ทุกโรงพยาบาล'
  const canAdd = ['admin','technician'].includes(stats.role || '')
  const number = (value:number) => new Intl.NumberFormat('th-TH').format(value)
  const progress = stats.total ? Math.round(stats.approvedCount / stats.total * 100) : 0
  const rejected = stats.rejectedCount
  const statusRows = [
    {label:'ฉบับร่าง',count:stats.draftCount,color:'bg-slate-400'},
    {label:'รออนุมัติ',count:stats.pendingApproval,color:'bg-amber-400'},
    {label:'ตีกลับให้แก้ไข',count:rejected,color:'bg-rose-400'},
    {label:'อนุมัติแล้ว',count:stats.approvedCount,color:'bg-emerald-600'},
  ]
  const trendMax = Math.max(1,...stats.monthlyTrend.map(p=>p.count))
  return <div className="space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm text-military-600 mb-1">{hospitalTitle}</p><h1 className="text-3xl font-semibold text-military-900">ภาพรวมงานสอบเทียบ</h1><p className="text-sm text-gray-500 mt-2">ติดตามสถานะและงานที่ต้องดำเนินการในที่เดียว</p></div>
      <div className="flex gap-2"><Link className="btn-secondary text-sm" href="/records">ประวัติสอบเทียบ</Link>{canAdd && <Link className="btn-primary text-sm" href="/records/new">+ เพิ่มข้อมูล</Link>}</div>
    </header>

    <section className="card !p-5" aria-label="ตัวกรองคำสั่ง">
      <form action="/dashboard" method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[220px] text-sm font-medium text-gray-700">ดูข้อมูลตามคำสั่ง
          <select name="order" defaultValue={stats.selectedOrder?._id || ''} className="input-field mt-2" key={stats.selectedOrder?._id || 'all'}>
            <option value="">ทุกคำสั่ง รวมรายการที่ไม่ผูกคำสั่ง</option>
            {stats.orders.map(order=><option key={order._id} value={order._id}>{order.orderNo} · {order.title}</option>)}
          </select>
        </label>
        <button className="btn-primary" type="submit">ดูข้อมูล</button>
        {stats.selectedOrder && <Link href="/dashboard" className="btn-secondary">ล้างตัวกรอง</Link>}
      </form>
      <p className="mt-3 text-xs text-gray-500">{stats.selectedOrder ? `คำสั่ง ${stats.selectedOrder.orderNo} · ${stats.selectedOrder.title}` : 'ภาพรวมทุกคำสั่ง'} · {hospitalTitle} · นับเฉพาะรายการที่บันทึกแล้ว</p>
    </section>

    <section className="grid grid-cols-2 xl:grid-cols-4 gap-4" aria-label="สรุปสถานะ">
      {[
        {label:'รายการทั้งหมด',value:stats.total,detail:'ในขอบเขตที่เลือก',tone:'text-military-900'},
        {label:'ต้องกรอก / แก้ไข',value:stats.draftCount+rejected,detail:`ฉบับร่าง ${number(stats.draftCount)} · ตีกลับ ${number(rejected)}`,tone:'text-slate-700'},
        {label:'รออนุมัติ',value:stats.pendingApproval,detail:`รอเกิน 3 วัน ${number(stats.pendingLong)} รายการ`,tone:'text-amber-700'},
        {label:'อนุมัติแล้ว',value:stats.approvedCount,detail:`${progress}% ของรายการทั้งหมด`,tone:'text-emerald-700'},
      ].map(card=><div key={card.label} className="card !p-5"><p className="text-sm text-gray-500">{card.label}</p><p className={`text-4xl font-semibold tracking-tight mt-3 ${card.tone}`}>{number(card.value)}</p><p className="text-xs text-gray-500 mt-3">{card.detail}</p></div>)}
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <section className="card xl:col-span-2">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-military-900">ความคืบหน้าการอนุมัติ</h2><span className="text-2xl font-semibold text-emerald-700">{progress}%</span></div>
        <p className="mt-1 text-sm text-gray-500">อนุมัติแล้ว {number(stats.approvedCount)} จาก {number(stats.total)} รายการ</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 mt-5" aria-label={`อนุมัติแล้ว ${progress}%`}>
          {statusRows.map(row=><div key={row.label} className={row.color} style={{width:stats.total?`${row.count/stats.total*100}%`:'0%'}} />)}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">{statusRows.map(row=><div key={row.label}><div className="flex items-center gap-2 text-xs text-gray-500"><span className={`h-2 w-2 rounded-full ${row.color}`} />{row.label}</div><p className="text-lg font-semibold mt-1">{number(row.count)}</p></div>)}</div>
      </section>
      <section className="card"><h2 className="font-semibold text-military-900">กำหนดสอบเทียบซ้ำ</h2><p className="mt-1 text-xs text-gray-500">จากใบรับรองที่อนุมัติแล้วในขอบเขตนี้</p><div className="mt-4 space-y-3"><div className="flex justify-between rounded-lg bg-rose-50 p-3 text-rose-800"><span>เกินกำหนด</span><strong>{number(stats.overdueRecalibration)}</strong></div><div className="flex justify-between rounded-lg bg-amber-50 p-3 text-amber-800"><span>ใกล้ครบกำหนด</span><strong>{number(stats.expiringSoon)}</strong></div></div><p className="mt-3 text-xs text-gray-500">อายุใบรับรอง {stats.certValidityMonths} เดือน · แจ้งล่วงหน้า {stats.alertBeforeDays} วัน</p></section>
    </div>

    <WorkList title={stats.role==='approver'?'งานที่รอคุณอนุมัติ':stats.role==='hospital_user'?'ใบรับรองล่าสุดของโรงพยาบาล':'งานที่ต้องติดตาม'} rows={stats.workList} emptyText="ไม่มีงานในขอบเขตที่เลือก" actionHref="/records" actionText="เปิดประวัติทั้งหมด" />

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <section className="card xl:col-span-2"><h2 className="font-semibold text-military-900">รายการที่เพิ่มใน 12 เดือน</h2><p className="text-xs text-gray-500 mt-1">นับตามวันที่สร้างรายการ</p>
        <div className="flex items-end gap-2 h-48 mt-5 border-b border-gray-100">{stats.monthlyTrend.map(p=><div key={p.key} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-2"><span className="text-xs text-gray-600">{p.count}</span><div className="w-full max-w-10 rounded-t bg-military-600" style={{height:`${p.count/trendMax*120}px`}} /><span className="text-[10px] text-gray-500 pb-2">{p.label}</span></div>)}</div>
      </section>
      <section className="card"><h2 className="font-semibold text-military-900">มูลค่างานที่อนุมัติแล้ว</h2><p className="text-xs text-gray-500 mt-1">เฉพาะขอบเขตที่เลือก</p><p className="text-3xl font-semibold text-military-900 mt-6">{number(stats.calPriceTotal+stats.mainPriceTotal)} <span className="text-sm font-normal">บาท</span></p><dl className="space-y-3 mt-6 text-sm"><div className="flex justify-between"><dt className="text-gray-500">ค่าสอบเทียบ</dt><dd>{number(stats.calPriceTotal)}</dd></div><div className="flex justify-between"><dt className="text-gray-500">ค่าปบ.</dt><dd>{number(stats.mainPriceTotal)}</dd></div></dl></section>
    </div>
    <WorkList title="รายการอัปเดตล่าสุด" rows={stats.recent} emptyText="ยังไม่มีรายการที่บันทึกในขอบเขตนี้" actionHref="/records" actionText="เปิดประวัติทั้งหมด" />
  </div>
}
