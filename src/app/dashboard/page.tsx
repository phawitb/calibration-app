import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import User from '@/models/User'
import Link from 'next/link'
import { calcRecalibrationDates, getRecalibrationSettings } from '@/lib/recalibration'

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

async function getStats() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  const hospitalUnit = (session?.user as any)?.hospitalUnit
  const username = String((session?.user as any)?.username || '')
  const { now, startToday, startWeek, startYear, startMonth, months12Ago } = getDateRanges()

  await connectDB()

  const scope: any = role === 'hospital_user' && hospitalUnit ? { unitName: String(hospitalUnit) } : {}
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

  const [approverQueue, recent, thisWeekRecent, pendingList, expiringSoonList, overdueList] =
    await Promise.all([
      approverQueuePromise,
      CalibrationRecord.find()
        .where(scope)
        .select('deviceName certNo calDate unitName lapTemp lapHumid approvalStatus requestedApproverName amedNo')
        .sort({ createdAt: -1, calDate: -1 })
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
    return { key, label: `${m}/${y.slice(2)}`, count: monthMap.get(key) || 0 }
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
  }
}

export default async function DashboardPage() {
  const stats = await getStats()
  const session = stats.session
  const role = stats.role as string | undefined
  const canAddRecord = role === 'admin' || role === 'technician'
  const currency = (v: number) => new Intl.NumberFormat('th-TH').format(Number(v || 0))

  const defaultStatCards = [
    { label: 'รวมทั้งหมด', value: stats.total, icon: '📊', color: 'bg-military-600', cardFilter: '' },
    { label: 'รออนุมัติ', value: stats.pendingApproval, icon: '⏳', color: 'bg-amber-500', cardFilter: 'pending' },
    { label: 'ใกล้ครบอายุ', value: stats.expiringSoon, icon: '⏰', color: 'bg-orange-600', cardFilter: 'expiring' },
    { label: 'เกินกำหนดสอบใหม่', value: stats.overdueRecalibration, icon: '🚨', color: 'bg-red-600', cardFilter: 'overdue' },
    { label: 'รายการสัปดาห์นี้', value: stats.thisWeek, icon: '🗓️', color: 'bg-blue-600', cardFilter: 'week' },
    { label: 'เพิ่มวันนี้', value: stats.todayAdded, icon: '🆕', color: 'bg-indigo-600', cardFilter: 'today' },
    { label: 'อนุมัติแล้ว', value: stats.approvedCount, icon: '✅', color: 'bg-emerald-600', cardFilter: 'approved' },
    { label: 'ฉบับร่าง', value: stats.draftCount, icon: '📝', color: 'bg-slate-600', cardFilter: 'draft' },
  ]
  const statCards =
    role === 'hospital_user'
      ? [
          ...defaultStatCards.slice(0, 6),
          {
            label: 'ค่าสอบเทียบรวม (อนุมัติแล้ว)',
            value: `฿${currency(stats.calPriceTotal)}`,
            icon: '💰',
            color: 'bg-emerald-700',
            cardFilter: 'approved',
          },
          {
            label: 'ค่าปบ.รวม (อนุมัติแล้ว)',
            value: `฿${currency(stats.mainPriceTotal)}`,
            icon: '🧾',
            color: 'bg-violet-700',
            cardFilter: 'approved',
          },
        ]
      : defaultStatCards

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-military-900">
            สวัสดี, {session?.user?.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">ภาพรวมงานสอบเทียบและอนุมัติประจำวัน</p>
        </div>
        {canAddRecord && (
          <Link href="/records/new" className="btn-primary flex items-center gap-2">
            <span>➕</span>
            <span className="hidden sm:inline">เพิ่มข้อมูลใหม่</span>
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {statCards.map(card => (
          <Link
            key={card.label}
            href={card.cardFilter ? `/records?cardFilter=${card.cardFilter}` : '/records'}
            className="card flex items-center gap-3 hover:ring-2 hover:ring-military-300 transition-all"
          >
            <div className={`${card.color} rounded-lg w-10 h-10 flex items-center justify-center text-xl`}>
              {card.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-military-900 leading-tight">{card.value}</p>
              <p className="text-gray-500 text-xs">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Role quick summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-military-800 mb-3">งานที่ต้องทำ</h2>
          <p className="text-xs text-gray-500 mb-2">
            เกณฑ์แจ้งเตือน: อายุใบเซอร์ {stats.certValidityMonths} เดือน / เตือนล่วงหน้า {stats.alertBeforeDays} วัน
          </p>
          <div className="space-y-2 text-sm">
            {role === 'technician' && (
              <>
                <p>• ร่างของฉัน: <span className="font-semibold">{stats.myDraft}</span> รายการ</p>
                <p>• รอผู้อนุมัติ: <span className="font-semibold">{stats.myPending}</span> รายการ</p>
                <p>• งานค้างเกิน 3 วัน: <span className="font-semibold">{stats.pendingLong}</span> รายการ</p>
                <p>• ใกล้ครบอายุสอบเทียบใหม่: <span className="font-semibold">{stats.expiringSoon}</span> รายการ</p>
              </>
            )}
            {role === 'approver' && (
              <>
                <p>• คิวรออนุมัติของฉัน: <span className="font-semibold">{stats.approverQueue}</span> รายการ</p>
                <p>• คิวรวมทั้งระบบ: <span className="font-semibold">{stats.pendingApproval}</span> รายการ</p>
                <p>• รายการค้างเกิน 3 วัน: <span className="font-semibold">{stats.pendingLong}</span> รายการ</p>
                <p>• ใบเซอร์ใกล้ครบอายุ: <span className="font-semibold">{stats.expiringSoon}</span> รายการ</p>
              </>
            )}
            {role === 'admin' && (
              <>
                <p>• โรงพยาบาลที่ใช้งาน: <span className="font-semibold">{stats.hospitals}</span> หน่วย</p>
                <p>• รายการปีนี้: <span className="font-semibold">{stats.thisYear}</span> รายการ</p>
                <p>• รายการค้างเกิน 3 วัน: <span className="font-semibold">{stats.pendingLong}</span> รายการ</p>
                <p>• ใกล้ครบอายุ/เกินกำหนด: <span className="font-semibold">{stats.expiringSoon + stats.overdueRecalibration}</span> รายการ</p>
              </>
            )}
            {role === 'hospital_user' && (
              <>
                <p>• รายการทั้งหมดของหน่วยงานคุณ: <span className="font-semibold">{stats.total}</span> รายการ</p>
                <p>• เพิ่มในสัปดาห์นี้: <span className="font-semibold">{stats.thisWeek}</span> รายการ</p>
                <p>• ใกล้ครบอายุสอบเทียบใหม่: <span className="font-semibold">{stats.expiringSoon}</span> รายการ</p>
              </>
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-military-800 mb-3">ทางลัด</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/records" className="btn-secondary text-sm">ดูข้อมูลสอบเทียบ</Link>
            {(role === 'admin' || role === 'approver') && (
              <Link href="/approvals" className="btn-secondary text-sm">งานรออนุมัติ</Link>
            )}
            {canAddRecord && (
              <Link href="/records/new" className="btn-secondary text-sm">สร้างรายการใหม่</Link>
            )}
            {role === 'admin' && (
              <Link href="/admin" className="btn-secondary text-sm">จัดการระบบ</Link>
            )}
          </div>
        </div>
      </div>

      {/* Proactive alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-military-800 mb-3">แจ้งเตือนเชิงรุก: ใกล้ครบอายุสอบเทียบใหม่</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Amed</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Cert No.</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">วันที่สอบเทียบ</th>
                </tr>
              </thead>
              <tbody>
                {stats.expiringSoonList.map((r: any) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-orange-50">
                    <td className="py-2 px-3 font-medium text-military-800">{r.amedNo || '-'}</td>
                    <td className="py-2 px-3">{r.certNo || '-'}</td>
                    <td className="py-2 px-3">{r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}</td>
                  </tr>
                ))}
                {stats.expiringSoonList.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-gray-400">ยังไม่มีรายการใกล้ครบอายุ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-military-800 mb-3">แจ้งเตือนเชิงรุก: เกินกำหนดสอบเทียบใหม่</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Amed</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Cert No.</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">วันที่สอบเทียบ</th>
                </tr>
              </thead>
              <tbody>
                {stats.overdueList.map((r: any) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-red-50">
                    <td className="py-2 px-3 font-medium text-military-800">{r.amedNo || '-'}</td>
                    <td className="py-2 px-3">{r.certNo || '-'}</td>
                    <td className="py-2 px-3">{r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}</td>
                  </tr>
                ))}
                {stats.overdueList.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-gray-400">ยังไม่มีรายการเกินกำหนด</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pending + weekly recents */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-military-800">รายการรออนุมัติล่าสุด</h2>
            <Link href="/approvals" className="text-military-600 text-sm hover:underline">เปิดคิวอนุมัติ →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">เลขใบรับรอง</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">เครื่องมือ</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">หน่วยงาน</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingList.map((r: any) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-military-50 transition-colors">
                    <td className="py-2 px-3 font-medium text-military-800">{r.certNo || '-'}</td>
                    <td className="py-2 px-3 text-gray-600">{r.deviceName || '-'}</td>
                    <td className="py-2 px-3 text-gray-600">{r.unitName || '-'}</td>
                  </tr>
                ))}
                {stats.pendingList.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-gray-400">ไม่มีรายการรออนุมัติ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-military-800">รายการที่เพิ่มล่าสุดของสัปดาห์</h2>
            <Link href="/records" className="text-military-600 text-sm hover:underline">ดูทั้งหมด →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">เลขใบรับรอง</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">เครื่องมือ</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {stats.thisWeekRecent.map((r: any) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-military-50 transition-colors">
                    <td className="py-2 px-3 font-medium text-military-800">{r.certNo || '-'}</td>
                    <td className="py-2 px-3 text-gray-600">{r.deviceName || '-'}</td>
                    <td className="py-2 px-3 text-gray-600">{r.approvalStatus || '-'}</td>
                  </tr>
                ))}
                {stats.thisWeekRecent.length === 0 && (
                  <tr><td colSpan={3} className="py-8 text-center text-gray-400">ยังไม่มีข้อมูลในสัปดาห์นี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Trend + tops */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <h2 className="font-semibold text-military-800 mb-3">แนวโน้มรายการใหม่ 12 สัปดาห์</h2>
          <div className="h-52 flex items-end gap-2 border-b border-l border-gray-200 p-2">
            {stats.weeklyTrend.map((p: any) => {
              const max = Math.max(...stats.weeklyTrend.map((x: any) => x.count), 1)
              const h = Math.max(6, Math.round((p.count / max) * 170))
              return (
                <div key={p.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <div className="text-[10px] text-military-700 font-medium">{p.count}</div>
                  <div className="w-full bg-military-700/85 rounded-t" style={{ height: `${h}px` }} />
                  <div className="text-[10px] text-gray-500">{p.label}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-military-800 mb-3">Top หน่วยงาน</h2>
            <div className="space-y-2">
              {stats.topUnits.map((u: any, idx: number) => (
                <div key={`${u.name}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate pr-2">{u.name || '-'}</span>
                  <span className="font-semibold text-military-800">{u.count}</span>
                </div>
              ))}
              {stats.topUnits.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>}
            </div>
          </div>
          <div className="card">
            <h2 className="font-semibold text-military-800 mb-3">Top จนท.ผู้บันทึกงาน</h2>
            <div className="space-y-2">
              {stats.topTechnicians.map((u: any, idx: number) => (
                <div key={`${u.username}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate pr-2">{u.name || u.username || '-'}</span>
                  <span className="font-semibold text-military-800">{u.count}</span>
                </div>
              ))}
              {stats.topTechnicians.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card xl:col-span-2">
          <h2 className="font-semibold text-military-800 mb-3">แนวโน้มรายเดือน 12 เดือน</h2>
          <div className="h-52 flex items-end gap-2 border-b border-l border-gray-200 p-2">
            {stats.monthlyTrend.map((p: any) => {
              const max = Math.max(...stats.monthlyTrend.map((x: any) => x.count), 1)
              const h = Math.max(6, Math.round((p.count / max) * 170))
              return (
                <div key={p.key} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
                  <div className="text-[10px] text-military-700 font-medium">{p.count}</div>
                  <div className="w-full bg-blue-700/85 rounded-t" style={{ height: `${h}px` }} />
                  <div className="text-[10px] text-gray-500">{p.label}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card">
          <h2 className="font-semibold text-military-800 mb-3">Top Amed ส่งสอบเทียบซ้ำ</h2>
          <div className="space-y-2">
            {stats.topRecalibration.map((r: any, idx: number) => (
              <div key={`${r.amedNo}-${idx}`} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate pr-2">
                  {r.amedNo} <span className="text-gray-400">({r.latestCertNo})</span>
                </span>
                <span className="font-semibold text-military-800">{r.count}</span>
              </div>
            ))}
            {stats.topRecalibration.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีข้อมูลส่งซ้ำ</p>}
          </div>
        </div>
      </div>

      {/* Recent records */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-military-800">รายการล่าสุด</h2>
          <Link href="/records" className="text-military-600 text-sm hover:underline">ดูทั้งหมด →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">เครื่องมือ</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">เลขที่ใบรับรอง</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">โรงพยาบาล</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">วันที่สอบเทียบ</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">อุณหภูมิ</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r: any) => (
                <tr key={r._id} className="border-b border-gray-50 hover:bg-military-50 transition-colors">
                  <td className="py-2 px-3 font-medium text-military-800">{r.deviceName || '-'}</td>
                  <td className="py-2 px-3 text-gray-600">{r.certNo || '-'}</td>
                  <td className="py-2 px-3 text-gray-600">{r.unitName || '-'}</td>
                  <td className="py-2 px-3 text-gray-600">
                    {r.calDate ? new Date(r.calDate).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="py-2 px-3 text-gray-600">{r.lapTemp ? `${r.lapTemp}°C` : '-'}</td>
                </tr>
              ))}
              {stats.recent.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
