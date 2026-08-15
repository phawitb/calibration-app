'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useHospitalWorkspace } from '@/components/HospitalWorkspace'
import { displayHospitalName } from '@/lib/hospitalUnit'

type HospitalRow = {
  name: string
  title: string
  jobs: number
  calPrice: number
  mainPrice: number
  approved: number
  pending: number
  draft: number
  rejected: number
}

type ReportSummary = {
  from: string
  to: string
  hospital: string
  totals: {
    jobs: number
    hospitals: number
    calPrice: number
    mainPrice: number
    totalPrice: number
    approved: number
    pending: number
    draft: number
    rejected: number
    approvedRate: number
  }
  byHospital: HospitalRow[]
  byStatus: { key: string; label: string; count: number }[]
  byType: { key: string; label: string; count: number }[]
  byMonth: { month: string; label: string; jobs: number; calPrice: number; mainPrice: number }[]
  byTechnician: { name: string; jobs: number; calPrice: number }[]
  byDevice: { name: string; jobs: number }[]
  byMethod: { name: string; jobs: number }[]
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function yearStart() {
  const n = new Date()
  return isoDate(new Date(n.getFullYear(), 0, 1))
}

function monthStart() {
  const n = new Date()
  return isoDate(new Date(n.getFullYear(), n.getMonth(), 1))
}

function monthsAgo(count: number) {
  const n = new Date()
  return isoDate(new Date(n.getFullYear(), n.getMonth() - (count - 1), 1))
}

const baht = (v: number) =>
  new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Number(v || 0))

const bahtFull = (v: number) => `฿${baht(v)}`

function StatusBar({ items, total }: { items: { label: string; count: number; color: string }[]; total: number }) {
  if (!total) return <div className="h-3 rounded-full bg-military-100" />
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-military-100">
      {items.filter((i) => i.count > 0).map((item) => (
        <div
          key={item.label}
          className={item.color}
          style={{ width: `${(item.count / total) * 100}%` }}
          title={`${item.label} ${item.count}`}
        />
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const { hospitals } = useHospitalWorkspace()
  const [from, setFrom] = useState(yearStart)
  const [to, setTo] = useState(() => isoDate(new Date()))
  const [hospital, setHospital] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<ReportSummary | null>(null)

  const load = useCallback(async (nextFrom = from, nextTo = to, nextHospital = hospital) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from: nextFrom, to: nextTo })
      if (nextHospital && nextHospital !== 'all') params.set('hospital', nextHospital)
      const res = await fetch(`/api/reports/summary?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'โหลดรายงานไม่สำเร็จ')
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'โหลดรายงานไม่สำเร็จ')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [from, hospital, to])

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (nextFrom: string, nextTo = isoDate(new Date())) => {
    setFrom(nextFrom)
    setTo(nextTo)
    load(nextFrom, nextTo, hospital)
  }

  const scopeLabel = hospital === 'all'
    ? 'ทุกหน่วยงาน'
    : displayHospitalName(hospital).title || hospital

  const maxMonthJobs = Math.max(1, ...(data?.byMonth.map((m) => m.jobs) || [1]))
  const statusColors = {
    approved: 'bg-emerald-600',
    pending_approval: 'bg-amber-500',
    draft: 'bg-slate-400',
    rejected: 'bg-red-500',
  }
  const statusItems = (data?.byStatus || []).map((s) => ({
    label: s.label,
    count: s.count,
    color: statusColors[s.key as keyof typeof statusColors] || 'bg-gray-400',
  }))

  const hospitalOptions = useMemo(
    () => hospitals.slice().sort((a, b) => displayHospitalName(a).title.localeCompare(displayHospitalName(b).title, 'th')),
    [hospitals],
  )

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gold-600">สรุปผลงาน</p>
          <h1 className="text-2xl font-bold text-military-900">รายงานผลงานสอบเทียบ</h1>
          <p className="text-sm text-gray-500 mt-1">
            สำหรับรายงานผู้บังคับบัญชา — นับตามวันที่สอบเทียบของ {scopeLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn-secondary text-sm" onClick={() => applyPreset(monthStart())}>เดือนนี้</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => applyPreset(yearStart())}>ปีนี้</button>
          <button type="button" className="btn-secondary text-sm" onClick={() => applyPreset(monthsAgo(12))}>12 เดือน</button>
          <button type="button" className="btn-primary text-sm" onClick={() => window.print()}>พิมพ์รายงาน</button>
        </div>
      </div>

      <div className="card print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">ตั้งแต่วันที่</span>
            <input type="date" className="input-field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">ถึงวันที่</span>
            <input type="date" className="input-field" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">โรงพยาบาล</span>
            <select className="input-field" value={hospital} onChange={(e) => setHospital(e.target.value)}>
              <option value="all">ทั้งหมด</option>
              {hospitalOptions.map((h) => (
                <option key={h} value={h}>{displayHospitalName(h).title || h}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={() => load()} disabled={loading}>
            {loading ? 'กำลังสรุป...' : 'แสดงรายงาน'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {data && (
        <>
          <div className="print:block hidden text-sm text-gray-600">
            ช่วง {new Date(data.from).toLocaleDateString('th-TH')} – {new Date(data.to).toLocaleDateString('th-TH')} · {scopeLabel}
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            {[
              { label: 'รพ. ที่สอบเทียบ', value: data.totals.hospitals, hint: 'หน่วยงานที่มีงานในช่วงนี้' },
              { label: 'งานสอบเทียบ', value: data.totals.jobs, hint: 'จำนวนรายการทั้งหมด' },
              { label: 'อนุมัติแล้ว', value: data.totals.approved, hint: `${Math.round(data.totals.approvedRate * 100)}% ของงานในช่วง` },
              { label: 'ค่าสอบเทียบรวม', value: bahtFull(data.totals.calPrice), hint: 'เฉพาะฟิลด์ราคาสอบเทียบ' },
              { label: 'รวมค่าสอบ + ค่าปบ.', value: bahtFull(data.totals.totalPrice), hint: `ค่าปบ. ${bahtFull(data.totals.mainPrice)}` },
            ].map((card) => (
              <div key={card.label} className="card py-4">
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-military-900 mt-1 leading-tight">{card.value}</p>
                <p className="text-[11px] text-gray-400 mt-1">{card.hint}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 card">
              <h2 className="font-semibold text-military-800 mb-3">งานแยกตามโรงพยาบาล</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500">
                      <th className="text-left py-2 pr-3 font-medium">โรงพยาบาล</th>
                      <th className="text-right py-2 px-2 font-medium">งาน</th>
                      <th className="text-right py-2 px-2 font-medium">อนุมัติ</th>
                      <th className="text-right py-2 px-2 font-medium">รอ/ร่าง/ตีกลับ</th>
                      <th className="text-right py-2 pl-2 font-medium">ค่าสอบเทียบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byHospital.map((row) => (
                      <tr key={row.name} className="border-b border-gray-50">
                        <td className="py-2 pr-3 font-medium text-military-900">{row.title}</td>
                        <td className="py-2 px-2 text-right">{row.jobs}</td>
                        <td className="py-2 px-2 text-right text-emerald-700">{row.approved}</td>
                        <td className="py-2 px-2 text-right text-gray-500">{row.pending + row.draft + row.rejected}</td>
                        <td className="py-2 pl-2 text-right">{bahtFull(row.calPrice)}</td>
                      </tr>
                    ))}
                    {data.byHospital.length === 0 && (
                      <tr><td colSpan={5} className="py-8 text-center text-gray-400">ไม่มีงานในช่วงที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card space-y-5">
              <div>
                <h2 className="font-semibold text-military-800 mb-2">ผลการสอบเทียบ</h2>
                <StatusBar items={statusItems} total={data.totals.jobs} />
                <ul className="mt-3 space-y-1.5 text-sm">
                  {data.byStatus.map((s) => (
                    <li key={s.key} className="flex justify-between">
                      <span className="text-gray-600">{s.label}</span>
                      <span className="font-semibold text-military-900">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-semibold text-military-800 mb-2">ประเภทงาน</h2>
                <ul className="space-y-1.5 text-sm">
                  {data.byType.map((s) => (
                    <li key={s.key} className="flex justify-between">
                      <span className="text-gray-600">{s.label}</span>
                      <span className="font-semibold text-military-900">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold text-military-800 mb-4">ปริมาณงานรายเดือน</h2>
            {data.byMonth.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลรายเดือน</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {data.byMonth.map((m) => (
                  <div key={m.month} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[10px] text-gray-500">{m.jobs}</span>
                    <div
                      className="w-full max-w-[42px] rounded-t bg-military-700"
                      style={{ height: `${Math.max(8, (m.jobs / maxMonthJobs) * 100)}%` }}
                      title={`${m.label}: ${m.jobs} งาน / ${bahtFull(m.calPrice)}`}
                    />
                    <span className="text-[10px] text-gray-500 truncate w-full text-center">{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="font-semibold text-military-800 mb-3">ผู้สอบเทียบ / ผู้ทำรายการ</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left py-2 font-medium">ชื่อ</th>
                    <th className="text-right py-2 font-medium">งาน</th>
                    <th className="text-right py-2 font-medium">ค่าสอบเทียบ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byTechnician.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 text-right">{row.jobs}</td>
                      <td className="py-2 text-right">{bahtFull(row.calPrice)}</td>
                    </tr>
                  ))}
                  {data.byTechnician.length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-gray-400">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h2 className="font-semibold text-military-800 mb-3">เครื่องมือที่สอบบ่อย</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="text-left py-2 font-medium">รายการ</th>
                    <th className="text-right py-2 font-medium">งาน</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byDevice.map((row) => (
                    <tr key={row.name} className="border-b border-gray-50">
                      <td className="py-2">{row.name}</td>
                      <td className="py-2 text-right">{row.jobs}</td>
                    </tr>
                  ))}
                  {data.byDevice.length === 0 && (
                    <tr><td colSpan={2} className="py-6 text-center text-gray-400">ไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
              {data.byMethod.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-500 mb-2">วิธีสอบเทียบ</h3>
                  <ul className="space-y-1 text-sm">
                    {data.byMethod.map((row) => (
                      <li key={row.name} className="flex justify-between">
                        <span className="text-gray-600">{row.name}</span>
                        <span className="font-medium">{row.jobs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
