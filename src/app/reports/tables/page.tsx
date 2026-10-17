'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { buildHospitalUnitOptions, displayHospitalName } from '@/lib/hospitalUnit'

type ReportType = 'unit' | 'yearly' | 'savings' | 'savings-yearly' | 'standards'

type Column = { key: string; header: string; align?: 'left' | 'right' | 'center'; kind?: 'number' | 'money' | 'date' }

type TorReport = {
  type: ReportType
  code: string
  title: string
  subtitle: string
  filters: { year: number | null; unitName: string | null; unitTitle: string | null; deviceName: string | null; status: string }
  years: number[]
  columns: Column[]
  rows: Record<string, unknown>[]
  total: Record<string, unknown> | null
  truncated: boolean
}

const TABS: { key: ReportType; code: string; label: string; staffOnly?: boolean }[] = [
  { key: 'unit', code: '1.3.2.1.1', label: 'รายงานผลสำหรับหน่วยรับบริการ' },
  { key: 'yearly', code: '1.3.2.2.1', label: 'รายงานผลการสอบเทียบรวม' },
  { key: 'savings', code: '1.3.2.2.2', label: 'รายงานการลดค่าใช้จ่าย', staffOnly: true },
  { key: 'savings-yearly', code: '1.3.2.2.3', label: 'การลดค่าใช้จ่ายรายปี', staffOnly: true },
  { key: 'standards', code: '1.3.2.2.4', label: 'เครื่องมือสอบเทียบประจำห้องปฏิบัติการ', staffOnly: true },
]

const usesYear = (t: ReportType) => t === 'unit' || t === 'yearly' || t === 'savings'
const usesUnit = (t: ReportType) => t === 'unit' || t === 'yearly'
const usesDevice = (t: ReportType) => t === 'yearly'

const numberFmt = new Intl.NumberFormat('th-TH')
const moneyFmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatCell(value: unknown, column: Column) {
  if (value == null || value === '') return ''
  if (column.kind === 'money') return typeof value === 'number' ? moneyFmt.format(value) : String(value)
  if (column.kind === 'number') return typeof value === 'number' ? numberFmt.format(value) : String(value)
  if (column.kind === 'date') {
    const d = new Date(String(value))
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return String(value)
}

const alignClass = (a?: Column['align']) => a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'

export default function TorReportTablesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined
  const isHospitalUser = role === 'hospital_user'
  const tabs = useMemo(() => TABS.filter((t) => !t.staffOnly || !isHospitalUser), [isHospitalUser])

  const [type, setType] = useState<ReportType>('unit')
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear() + 543))
  const [unitName, setUnitName] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [deviceInput, setDeviceInput] = useState('')
  const [allStatus, setAllStatus] = useState(false)
  const [unitOptions, setUnitOptions] = useState<string[]>([])
  const [data, setData] = useState<TorReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printedAt, setPrintedAt] = useState('')

  useEffect(() => {
    if (isHospitalUser) return
    fetch('/api/reference?type=units')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const options = buildHospitalUnitOptions(Array.isArray(j?.data) ? j.data : [])
          .sort((a, b) => (displayHospitalName(a).title || a).localeCompare(displayHospitalName(b).title || b, 'th'))
        setUnitOptions(options)
      })
      .catch(() => setUnitOptions([]))
  }, [isHospitalUser])

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ type })
    if (usesYear(type) && year) params.set('year', year)
    if (usesUnit(type) && unitName) params.set('unitName', unitName)
    if (usesDevice(type) && deviceName) params.set('deviceName', deviceName)
    if (allStatus && type !== 'standards') params.set('status', 'all')
    return params.toString()
  }, [type, year, unitName, deviceName, allStatus])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/tor?${queryString}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'โหลดรายงานไม่สำเร็จ')
      setData(json)
      setPrintedAt(new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }))
    } catch (err: any) {
      setError(err?.message || 'โหลดรายงานไม่สำเร็จ')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => { load() }, [load])

  const yearOptions = useMemo(() => {
    const set = new Set<number>(data?.years || [])
    if (/^\d{4}$/.test(year)) set.add(Number(year))
    set.add(new Date().getFullYear() + 543)
    return Array.from(set).sort((a, b) => b - a)
  }, [data?.years, year])

  const activeTab = tabs.find((t) => t.key === type) || tabs[0]
  const exportHref = `/api/reports/tor?${queryString}&format=xlsx`

  return (
    <div className="space-y-5">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #tor-print-area, #tor-print-area * { visibility: visible; }
          #tor-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          #tor-print-area table { font-size: 12px; }
          #tor-print-area th, #tor-print-area td { border: 1px solid #333 !important; padding: 4px 6px !important; }
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-gold-600">รายงานตามแบบฟอร์ม TOR</p>
          <h1 className="text-2xl font-bold text-military-900">รายงานตามแบบฟอร์ม</h1>
          <p className="text-sm text-gray-500 mt-1">ตารางรายงานตามข้อกำหนด 1.3.2 — นับเฉพาะรายการที่อนุมัติแล้ว เว้นแต่เลือก “ทุกสถานะ”</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/reports" className="btn-secondary text-sm">← สรุปผลงาน</Link>
          <a href={exportHref} className="btn-secondary text-sm" download>ส่งออก Excel</a>
          <button type="button" className="btn-primary text-sm" onClick={() => window.print()} disabled={!data}>พิมพ์ / PDF</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="ประเภทรายงาน">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === type}
            onClick={() => setType(tab.key)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${tab.key === type ? 'border-military-700 bg-military-700 text-white' : 'border-gray-200 bg-white text-military-800 hover:bg-military-50'}`}
          >
            <span className={`block text-[10px] tracking-wide ${tab.key === type ? 'text-military-100' : 'text-gray-400'}`}>{tab.code}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {type !== 'standards' && (
        <div className="card print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            {usesYear(type) && (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">ปี พ.ศ.</span>
                <select className="input-field" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">ทุกปี</option>
                  {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                </select>
              </label>
            )}
            {usesUnit(type) && !isHospitalUser && (
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">หน่วยรับบริการ</span>
                <select className="input-field" value={unitName} onChange={(e) => setUnitName(e.target.value)}>
                  <option value="">ทุกหน่วยรับบริการ</option>
                  {unitOptions.map((u) => <option key={u} value={u}>{displayHospitalName(u).title || u}</option>)}
                </select>
              </label>
            )}
            {usesDevice(type) && (
              <form
                className="text-sm"
                onSubmit={(e) => { e.preventDefault(); setDeviceName(deviceInput.trim()) }}
              >
                <span className="block text-gray-600 mb-1">ชื่อเครื่องมือ</span>
                <div className="flex gap-2">
                  <input className="input-field" placeholder="เช่น Infusion Pump" value={deviceInput} onChange={(e) => setDeviceInput(e.target.value)} maxLength={200} />
                  <button type="submit" className="btn-secondary text-sm whitespace-nowrap">ค้นหา</button>
                </div>
              </form>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
              <input type="checkbox" className="accent-military-700" checked={allStatus} onChange={(e) => setAllStatus(e.target.checked)} />
              รวมทุกสถานะ (ไม่เฉพาะอนุมัติแล้ว)
            </label>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{error}</div>}

      <div id="tor-print-area" className="card p-0 overflow-hidden print:shadow-none print:border-0">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <p className="text-xs text-gray-500">{activeTab.code}</p>
          <h2 className="text-lg font-semibold text-military-900">{data?.title || activeTab.label}</h2>
          <p className="text-sm text-gray-600 mt-1">{data?.subtitle || ''}</p>
          <p className="text-xs text-gray-400 mt-1">วันที่พิมพ์ {printedAt || '-'}{data?.truncated ? ' · แสดงสูงสุด 20,000 รายการ' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-military-50 text-military-900">
              <tr>
                {(data?.columns || []).map((c) => (
                  <th key={c.key} className={`px-3 py-2 font-semibold border-b border-gray-200 ${alignClass(c.align)}`}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={Math.max(1, data?.columns.length || 1)} className="py-10 text-center text-gray-400">กำลังโหลดรายงาน...</td></tr>
              )}
              {!loading && data && data.rows.length === 0 && (
                <tr><td colSpan={Math.max(1, data.columns.length)} className="py-10 text-center text-gray-400">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</td></tr>
              )}
              {!loading && data?.rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-military-50/40">
                  {data.columns.map((c) => (
                    <td key={c.key} className={`px-3 py-1.5 ${alignClass(c.align)} ${c.kind === 'money' || c.kind === 'number' ? 'tabular-nums' : ''}`}>{formatCell(row[c.key], c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {!loading && data?.total && (
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-military-900">
                  {data.columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 border-t border-gray-200 ${alignClass(c.align)} tabular-nums`}>{formatCell(data.total?.[c.key], c)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
