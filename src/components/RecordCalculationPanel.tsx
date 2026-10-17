'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { fmt, formatCalibrationValue } from '@/lib/uncertainty'
import type { UcComponentResult, CalPointResult, UncertaintyComponent, IsoCalculationResult } from '@/lib/uncertainty'
import { VERDICT_LABELS, VERDICTS, type Verdict } from '@/lib/acceptance'
import type { AcceptanceResult } from '@/lib/recordAcceptance'

type CalculateResponse = {
  calibrationType?: 'sbcal' | 'iso'
  ucResults?: Record<string, UcComponentResult | undefined>
  isoResult?: IsoCalculationResult | null
  acceptanceResult?: AcceptanceResult | null
}

const VERDICT_BADGE: Record<Verdict, string> = {
  pass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  fail: 'bg-red-100 text-red-800 border-red-300',
  na: 'bg-gray-100 text-gray-700 border-gray-300',
}

function VerdictBadge({ verdict, manual }: { verdict: Verdict; manual?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${VERDICT_BADGE[verdict]}`}>
      {VERDICT_LABELS[verdict]}
      {manual && <span className="font-normal text-[10px]">(กำหนดเอง)</span>}
    </span>
  )
}

/** ผลการตัดสิน ผ่าน/ไม่ผ่าน/N/A ต่อจุด + ผลรวม พร้อมช่องกำหนดเอง (PUT /api/records/[id]/verdict) */
function AcceptancePanel({
  recordId,
  result,
  canOverride,
  lockedReason,
  onUpdated,
}: {
  recordId: string
  result: AcceptanceResult
  canOverride: boolean
  lockedReason?: string
  onUpdated: (next: AcceptanceResult) => void
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const groupLabel = (g: string) => (g === 'iso' ? 'ISO' : g.toUpperCase().replace('UCT', 'UcT'))

  const sendOverride = async (key: string, body: Record<string, unknown>) => {
    setBusyKey(key)
    try {
      const res = await fetch(`/api/records/${recordId}/verdict`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'บันทึกผลการตัดสินไม่สำเร็จ')
      if (json.acceptanceResult) onUpdated(json.acceptanceResult)
      toast.success('บันทึกผลการตัดสินแล้ว')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusyKey(null)
    }
  }

  const selectClass = 'input-field text-xs py-1 w-32 disabled:bg-gray-100 disabled:text-gray-500'
  return (
    <div className="card p-0 overflow-hidden" data-testid="acceptance-panel">
      <div className="px-4 py-2 bg-military-800 text-white flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          ผลการตัดสิน (เกณฑ์การยอมรับ){' '}
          <span className="font-normal text-military-200">
            {result.description || 'ยังไม่ได้กำหนด MPE — ผลเป็น N/A จนกว่าจะกรอกเกณฑ์ในแบบฟอร์ม'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-military-200">ผลรวม</span>
          <VerdictBadge verdict={result.overall} manual={result.overallManual} />
          <select
            aria-label="กำหนดผลรวมเอง"
            className={selectClass}
            disabled={!canOverride || busyKey === 'overall'}
            title={!canOverride ? lockedReason : undefined}
            value={result.overallManual ? result.overall : ''}
            onChange={(e) => sendOverride('overall', { overall: e.target.value })}
          >
            <option value="">อัตโนมัติ ({VERDICT_LABELS[result.autoOverall]})</option>
            {VERDICTS.map((v) => (
              <option key={v} value={v}>{VERDICT_LABELS[v]}</option>
            ))}
          </select>
        </div>
      </div>
      {!canOverride && lockedReason && (
        <p className="px-4 py-1.5 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">{lockedReason}</p>
      )}
      {result.points.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">ยังไม่มีจุดสอบเทียบสำหรับตัดสินผล</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-left text-gray-700">
                <th className="py-1.5 px-2">กลุ่ม</th>
                <th className="py-1.5 px-2">จุดสอบเทียบ</th>
                <th className="py-1.5 px-2 text-right">ค่าคลาดเคลื่อน</th>
                <th className="py-1.5 px-2 text-right">U</th>
                <th className="py-1.5 px-2 text-center">ผล</th>
                <th className="py-1.5 px-2">กำหนดเอง</th>
              </tr>
            </thead>
            <tbody>
              {result.points.map((p) => {
                const key = `${p.group}:${p.index}`
                return (
                  <tr key={key} className="border-b border-gray-100 even:bg-gray-50/50">
                    <td className="py-1 px-2 font-medium">{groupLabel(p.group)}</td>
                    <td className="py-1 px-2">{String(p.point ?? '')} {p.unit}</td>
                    <td className="py-1 px-2 text-right">{Number.isFinite(p.error) ? fmt(p.error, 4) : '—'}</td>
                    <td className="py-1 px-2 text-right">{Number.isFinite(p.expandedU) ? fmt(p.expandedU, 4) : '—'}</td>
                    <td className="py-1 px-2 text-center"><VerdictBadge verdict={p.verdict} manual={p.manual} /></td>
                    <td className="py-1 px-2">
                      <select
                        aria-label={`กำหนดผลจุด ${groupLabel(p.group)} ${p.index + 1}`}
                        className={selectClass}
                        disabled={!canOverride || busyKey === key}
                        title={!canOverride ? lockedReason : undefined}
                        value={p.manual ? p.verdict : ''}
                        onChange={(e) => sendOverride(key, { group: p.group, index: p.index, verdict: e.target.value })}
                      >
                        <option value="">อัตโนมัติ ({VERDICT_LABELS[p.autoVerdict]})</option>
                        {VERDICTS.map((v) => (
                          <option key={v} value={v}>{VERDICT_LABELS[v]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CalPointBlock({ pt, ucLabel, index, isTime = false }: { pt: CalPointResult; ucLabel: string; index: number; isTime?: boolean }) {
  const display = (value: number, decimals = 4) => isTime ? formatCalibrationValue(value, true, decimals === 4 ? 3 : decimals) : fmt(value, decimals)
  const n = pt.uucReadings?.length || 4
  return (
    <div className="card p-0 overflow-hidden">
      {/* Header: readings + summary */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {/* Row 1: Uc label + Resolution + Std Read ... summary labels */}
            <tr className="bg-yellow-50 border-b border-yellow-200">
              <td className="py-1 px-2 font-semibold text-military-800 border-r border-yellow-200" colSpan={n + 2}>
                {ucLabel} Resolution Std{index} Read
              </td>
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">- AvgUUC</td>
              <td className="py-1 px-2 font-medium text-right">{display(pt.avgUUC)}</td>
            </tr>
            {/* Row 2: Calpoint */}
            <tr className="bg-yellow-50 border-b border-yellow-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>Calpoint{index}</td>
              <td className="py-1 px-2 font-medium" colSpan={n}>{isTime ? formatCalibrationValue(pt.point, true) : pt.point}</td>
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">-uT Rep(UUC)</td>
              <td className="py-1 px-2 font-medium text-right">{display(pt.uTRepUUC, 10)}</td>
            </tr>
            {/* Row 3: N headers */}
            <tr className="border-b border-gray-200">
              <td className="py-1 px-2 font-medium text-center" colSpan={2}>N</td>
              {Array.from({ length: n }, (_, i) => (
                <td key={i} className="py-1 px-2 text-center font-medium">{i + 1}</td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">- Avg.STD</td>
              <td className="py-1 px-2 font-medium text-right">{display(pt.avgSTD)}</td>
            </tr>
            {/* Row 4: UUC Read */}
            <tr className="bg-yellow-50 border-b border-yellow-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>UUC Read</td>
              {(pt.uucReadings || []).map((v, i) => (
                <td key={i} className="py-1 px-2 text-center">{isTime ? formatCalibrationValue(v, true) : v}</td>
              ))}
              {Array.from({ length: Math.max(0, n - (pt.uucReadings?.length || 0)) }, (_, i) => (
                <td key={`e${i}`} className="py-1 px-2"></td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">-StdCorrection</td>
              <td className="py-1 px-2 font-medium text-right">{display(pt.stdCorrection)}</td>
            </tr>
            {/* Row 5: STD Read */}
            <tr className="border-b border-gray-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>STD Read</td>
              {(pt.stdReadings || []).map((v, i) => (
                <td key={i} className="py-1 px-2 text-center">{isTime ? formatCalibrationValue(v, true) : v}</td>
              ))}
              {Array.from({ length: Math.max(0, n - (pt.stdReadings?.length || 0)) }, (_, i) => (
                <td key={`e${i}`} className="py-1 px-2"></td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200 bg-yellow-50">- AvgSTDRead</td>
              <td className="py-1 px-2 font-medium text-right bg-yellow-50">{display(pt.avgSTDRead)}</td>
            </tr>
            {/* Row 6: uT Rep.(STD) */}
            <tr className="border-b border-gray-300">
              <td colSpan={n + 2}></td>
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">- uT Rep.(STD)</td>
              <td className="py-1 px-2 font-medium text-right">{display(pt.uTRepSTD, 10)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Uncertainty Budget */}
      <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-700">
        Uncertainty Budget
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-military-800 text-white text-left">
              <th className="py-1.5 px-2">Symbol (u)</th>
              <th className="py-1.5 px-2">Type</th>
              <th className="py-1.5 px-2">Source of Uncertainty</th>
              <th className="py-1.5 px-2 text-right">Value</th>
              <th className="py-1.5 px-2 text-center">Probability</th>
              <th className="py-1.5 px-2 text-right">Divisor</th>
              <th className="py-1.5 px-2 text-center">Ci</th>
              <th className="py-1.5 px-2 text-right">Ui(T)</th>
              <th className="py-1.5 px-2 text-right">Vi</th>
              <th className="py-1.5 px-2 text-right">Ui(T)²</th>
            </tr>
          </thead>
          <tbody>
            {pt.components.map((c: UncertaintyComponent, i: number) => (
              <tr key={i} className="border-b border-gray-100 even:bg-gray-50/50">
                <td className="py-1 px-2 font-mono text-xs">{c.symbol}</td>
                <td className="py-1 px-2 text-center">{c.type}</td>
                <td className="py-1 px-2">{c.source}</td>
                <td className="py-1 px-2 text-right">{fmt(c.value, 10)}</td>
                <td className="py-1 px-2 text-center">{c.probability}</td>
                <td className="py-1 px-2 text-right">{fmt(c.divisor, 3)}</td>
                <td className="py-1 px-2 text-center">{c.ci}</td>
                <td className="py-1 px-2 text-right font-medium">{fmt(c.ui, 10)}</td>
                <td className="py-1 px-2 text-right">{Number.isFinite(c.vi) ? fmt(c.vi, 2) : '∞'}</td>
                <td className="py-1 px-2 text-right">{fmt(c.ui2, 10)}</td>
              </tr>
            ))}
            {/* uc row */}
            <tr className="border-b border-gray-200 bg-yellow-50 font-semibold">
              <td className="py-1 px-2">uc</td>
              <td className="py-1 px-2 text-center">-</td>
              <td className="py-1 px-2">Combined uncertainty, Uc(T)</td>
              <td className="py-1 px-2"></td>
              <td className="py-1 px-2 text-center">normal</td>
              <td className="py-1 px-2"></td>
              <td className="py-1 px-2"></td>
                <td className="py-1 px-2 text-right">{display(pt.uc, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.veff, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.veff, 10)}</td>
            </tr>
            {/* U row */}
            <tr className="bg-yellow-50 font-semibold">
              <td className="py-1 px-2">U</td>
              <td className="py-1 px-2 text-center">-</td>
              <td className="py-1 px-2">Expanded uncertainty, U</td>
              <td className="py-1 px-2"></td>
              <td className="py-1 px-2 text-center">normal (k={fmt(pt.k, 2)})</td>
              <td className="py-1 px-2"></td>
              <td className="py-1 px-2"></td>
                <td className="py-1 px-2 text-right">{display(pt.U, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.k, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.k, 10)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RecordCalculationPanel({
  recordId,
  approvalStatus,
  canEdit = true,
}: {
  recordId: string
  /** สถานะอนุมัติของ record — approved/pending_approval ปิดการกำหนดผลเอง */
  approvalStatus?: string
  /** ผู้ดูมีสิทธิ์แก้ไข record นี้หรือไม่ */
  canEdit?: boolean
}) {
  const [data, setData] = useState<CalculateResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/records/${recordId}/calculate`)
      .then((r) => {
        if (!r.ok) throw new Error('โหลดไม่สำเร็จ')
        return r.json()
      })
      .then((j) => {
        if (!cancelled) {
          setData({
            calibrationType: j.calibrationType,
            ucResults: j.ucResults,
            isoResult: j.isoResult,
            acceptanceResult: j.acceptanceResult || null,
          })
          setErr(null)
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e?.message || 'Error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [recordId])

  if (loading) {
    return <p className="text-gray-500 text-sm">กำลังคำนวณ…</p>
  }
  if (err) {
    return <p className="text-red-600 text-sm">{err}</p>
  }
  if (!data) return null

  const statusLocked = approvalStatus === 'approved' || approvalStatus === 'pending_approval'
  const lockedReason = statusLocked
    ? approvalStatus === 'approved'
      ? 'ใบรับรองนี้อนุมัติแล้ว แก้ไขผลการตัดสินไม่ได้'
      : 'รายการอยู่ระหว่างรออนุมัติ กรุณาบันทึกเป็นฉบับร่างก่อนแก้ไขผลการตัดสิน'
    : !canEdit
      ? 'คุณไม่มีสิทธิ์แก้ไขผลการตัดสินของรายการนี้'
      : undefined
  const acceptancePanel = data.acceptanceResult ? (
    <AcceptancePanel
      recordId={recordId}
      result={data.acceptanceResult}
      canOverride={!statusLocked && canEdit}
      lockedReason={lockedReason}
      onUpdated={(next) => setData((d) => (d ? { ...d, acceptanceResult: next } : d))}
    />
  ) : null

  // ISO calculation result
  if (data.calibrationType === 'iso') {
    return (
      <div className="min-w-0 space-y-6">
        {acceptancePanel}
        <IsoResultPanel isoResult={data.isoResult} />
      </div>
    )
  }

  // SbCal calculation result
  const ucResults = data.ucResults || {}
  const order = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
  const blocks = order
    .map((k) => ({ key: k, uc: ucResults[k] }))
    .filter((b) => b.uc && (b.uc.points || []).length > 0)

  if (blocks.length === 0) {
    return <p className="text-gray-500 text-sm">ยังไม่มีข้อมูล Uc สำหรับคำนวณ</p>
  }

  return (
    <div className="min-w-0 space-y-8">
      {acceptancePanel}
      {blocks.map(({ key, uc }) => {
        const ucIdx = blocks.indexOf(blocks.find(b => b.key === key)!)
        return (
          <div key={key} className="space-y-4">
            <h2 className="text-lg font-bold text-military-800">
              {key.toUpperCase()}{' '}
              {uc?.stdName ? <span className="font-normal text-gray-600">— {uc.stdName}</span> : null}
              {uc?.unit ? <span className="text-sm text-gray-500"> ({uc.measurement} · {uc.unit})</span> : null}
            </h2>
            {(uc?.points || []).map((pt, pi) => (
              <CalPointBlock
                key={pi}
                pt={pt}
                ucLabel={`${key.toUpperCase().replace('UCT', 'UcT')}${pi + 1}`}
                index={ucIdx + 1}
                isTime={String(uc?.measurement || '').toLowerCase() === 'time' || String(uc?.unit || '').toLowerCase() === 'h:mm:ss'}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function IsoResultPanel({ isoResult }: { isoResult?: IsoCalculationResult | null }) {
  if (!isoResult) {
    return <p className="text-gray-500 text-sm">ยังไม่มีข้อมูลสำหรับคำนวณ (กรุณากรอกข้อมูล Std1 และ Readings)</p>
  }

  const FormulaDetails = ({ point }: { point: any }) => {
    const methodCode = (isoResult as any).methodCode || isoResult.isoMethodCode
    const isComparison = point.stdMean != null || point.correction != null
    const isEmptyChamber = methodCode === 'TEM-001-1'
    const isLoadedChamber = methodCode === 'TEM-001-2'
    const isChamber = isEmptyChamber || isLoadedChamber
    const isAutoclave = methodCode === 'TEM-004'
    const isDtmPermanent = methodCode === 'TEM-003-1'
    const isDtmOnsite = methodCode === 'TEM-003-2'
    const isTypeK = methodCode === 'TEM-003-3'
    const repeatability = point.uncertaintyBudget.find((source: any) => source.key === 'dT_Rep_UUC')
    const repStd = point.uncertaintyBudget.find((source: any) => source.key === 'dT_Rep_Std')
    const vertical = point.uncertaintyBudget.find((source: any) => source.key === 'dT_Vert')
    const stability = point.uncertaintyBudget.find((source: any) => source.key === 'dT_Stab')
    const n = Number.isFinite(repeatability?.vi) ? repeatability.vi + 1 : undefined

    return (
      <details className="border-t border-blue-100 bg-blue-50/40">
        <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-blue-800 hover:bg-blue-50">
          แสดงรายละเอียดการคำนวณตาม Excel
        </summary>
        <div className="px-4 pb-3 pt-1 space-y-2 text-xs text-gray-700">
          {isDtmPermanent ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>Avg STD</b> = AVERAGE(STD 5 ครั้ง) = <b>{fmt(point.stdMean ?? 0, 8)}</b></p>
              <p><b>UUC แสดงผล</b> = CEILING.MATH(AVERAGE(UUC), resolution) = <b>{fmt(point.indicatingReading ?? 0, 8)}</b></p>
              <p><b>Correction</b> = Avg STD − UUC แสดงผล = <b>{fmt(point.correction ?? 0, 8)}</b></p>
              <p><b>Repeatability</b> = STDEV.S (ไม่หาร √n) STD = <b>{fmt(repStd?.value ?? 0, 8)}</b> · UUC = <b>{fmt(repeatability?.value ?? 0, 8)}</b></p>
              <p><b>CMC</b> = ถ้าจุด &lt; 0°C ใช้ 0.04 ไม่เช่นนั้น 0.03 = <b>{fmt(point.cmc ?? 0, 2)}</b></p>
              <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC ไม่เช่นนั้น ROUNDUP(U, 3) = <b>{fmt(point.reportedU, 3)}</b></p>
            </div>
          ) : isDtmOnsite ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>Avg STD</b> = AVERAGE(STD 5 ครั้ง) = <b>{fmt(point.stdMean ?? 0, 8)}</b></p>
              <p><b>Avg UUC</b> = AVERAGE(UUC 5 ครั้ง) = <b>{fmt(point.indicatingReading ?? 0, 8)}</b></p>
              <p><b>Correction</b> = Avg STD − Avg UUC = <b>{fmt(point.correction ?? 0, 8)}</b></p>
              <p><b>Repeatability</b> = STDEV.S (ไม่หาร √n) STD = <b>{fmt(repStd?.value ?? 0, 8)}</b> · UUC = <b>{fmt(repeatability?.value ?? 0, 8)}</b></p>
              <p><b>CMC</b> = 0.05 °C = <b>{fmt(point.cmc ?? 0, 2)}</b></p>
              <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC ไม่เช่นนั้น CEILING(U, 0.001) = <b>{fmt(point.reportedU, 3)}</b></p>
            </div>
          ) : isTypeK ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>Avg STD</b> = AVERAGE(STD 5 ครั้ง) = <b>{fmt(point.stdMean ?? 0, 8)}</b></p>
              <p><b>Avg UUC</b> = AVERAGE(UUC 5 ครั้ง) = <b>{fmt(point.indicatingReading ?? 0, 8)}</b></p>
              <p><b>Correction</b> = Avg STD − Avg UUC = <b>{fmt(point.correction ?? 0, 8)}</b></p>
              <p><b>Repeatability</b> = STDEV.S (ไม่หาร √n) STD = <b>{fmt(repStd?.value ?? 0, 8)}</b> · UUC = <b>{fmt(repeatability?.value ?? 0, 8)}</b></p>
              <p><b>IRJ</b> = |(UUC−STD)₁ − (UUC−STD)₂| = <b>{fmt((point.uncertaintyBudget.find((s: any) => s.key === 'dT_IRJ')?.value) ?? 0, 8)}</b></p>
              <p><b>Inhomogeneity</b> = สายใหม่ 0.1 / สายเก่า 0.44 = <b>{fmt((point.uncertaintyBudget.find((s: any) => s.key === 'dT_Inh')?.value) ?? 0, 8)}</b></p>
              <p><b>CMC</b> = ถ้าจุด &gt; 50°C ใช้ 0.5 ไม่เช่นนั้น 0.4 = <b>{fmt(point.cmc ?? 0, 1)}</b></p>
              <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC ไม่เช่นนั้น ROUNDUP(U, 2) = <b>{fmt(point.reportedU, 2)}</b></p>
            </div>
          ) : isComparison ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>Avg UUC</b> = AVERAGE(UUC 4 ครั้ง) = <b>{fmt(point.indicatingReading ?? point.sensorResults?.[0]?.mean ?? 0, 8)}</b></p>
              <p><b>Avg STD</b> = AVERAGE(STD tachometer + Std Correction) = <b>{fmt(point.stdMean ?? 0, 8)}</b></p>
              <p><b>Correction</b> = Avg STD − Avg UUC = <b>{fmt(point.correction ?? 0, 8)}</b></p>
              <p><b>Repeatability STD</b> = STDEV.S(STD+Corr) / √n = <b>{fmt(repStd?.value ?? 0, 8)}</b></p>
              <p><b>Repeatability UUC</b> = STDEV.S(UUC) / √n{n ? `, n = ${n}` : ''} = <b>{fmt(repeatability?.value ?? 0, 8)}</b></p>
              <p><b>CMC</b> (จากค่าเฉลี่ย UUC) = <b>{fmt(point.cmc ?? 0, 2)}</b></p>
              <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ ROUNDUP(CMC, 2) ไม่เช่นนั้น ROUNDUP(U, 1) = <b>{fmt(point.reportedU, 2)}</b></p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>ค่าเฉลี่ยแต่ละ Sensor</b> = AVERAGE(ค่าของ Sensor นั้นทุกแถว)</p>
              <p><b>Stability</b> = MAX[(MAX(Sensor) − MIN(Sensor)) ÷ 2] = <b>{fmt(point.stability, 8)}</b></p>
              <p><b>Uniformity</b> = MAX|Sensor {isAutoclave ? '#2 (P2 center)' : isChamber ? '#9 (center)' : 'center'} − Sensor ตำแหน่งอื่น| ในทุกแถว = <b>{fmt(point.uniformity, 8)}</b></p>
              {vertical && (
                <p><b>Vertical Uniformity</b> = MAX(|AVG(center) − AVG(top)|, |AVG(center) − AVG(bottom)|) = <b>{fmt(point.verticalUniformity ?? 0, 8)}</b></p>
              )}
              <p><b>UUC Reading เฉลี่ย</b> = AVERAGE(UUC Reading) = <b>{fmt(point.indicatingReading ?? 0, 8)}</b></p>
              <p><b>Repeatability UUC</b> = STDEV.S(UUC Reading){n ? `, n = ${n}` : ''} = <b>{fmt(repeatability?.value ?? 0, 8)}</b></p>
              {isEmptyChamber && (
                <>
                  <p><b>Loading</b> = Uniformity × 0.2 = <b>{fmt((point.uncertaintyBudget.find((s: any) => s.key === 'dT_Load')?.value) ?? 0, 8)}</b></p>
                  <p><b>CMC</b> = <b>{fmt(point.cmc ?? 0, 2)}</b></p>
                  <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC; ถ้า U &gt; 1 ปัดขึ้น 1 ตำแหน่ง ไม่เช่นนั้นปัดขึ้น 2 ตำแหน่ง = <b>{fmt(point.reportedU, 2)}</b></p>
                </>
              )}
              {isLoadedChamber && (
                <>
                  <p><b>Loading</b> = T no load × 0.2 = <b>{fmt((point.uncertaintyBudget.find((s: any) => s.key === 'dT_Load')?.value) ?? 0, 8)}</b></p>
                  <p><b>CMC</b> = <b>{Number.isFinite(point.cmc) ? fmt(point.cmc, 2) : 'นอกช่วง (&gt; 40°C)'}</b></p>
                  <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC; ถ้า U &gt; 1 ปัดขึ้น 1 ตำแหน่ง ไม่เช่นนั้นปัดขึ้น 2 ตำแหน่ง = <b>{fmt(point.reportedU, 2)}</b></p>
                </>
              )}
              {isAutoclave && (
                <>
                  <p><b>Loading</b> = Uniformity × 0.2 = <b>{fmt((point.uncertaintyBudget.find((s: any) => s.key === 'dT_Load')?.value) ?? 0, 8)}</b></p>
                  <p><b>CMC</b> = 0.88 °C = <b>{fmt(point.cmc ?? 0, 2)}</b></p>
                  <p><b>Reported U</b> = ถ้า U &lt; CMC ใช้ CMC ไม่เช่นนั้น CEILING(U, 0.01) = <b>{fmt(point.reportedU, 2)}</b></p>
                </>
              )}
            </div>
          )}
          {Array.isArray(point.sensorResults) && point.sensorResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full max-w-xl border-collapse text-xs">
                <thead><tr className="bg-blue-100 text-left"><th className="border border-blue-200 px-2 py-1">Sensor</th><th className="border border-blue-200 px-2 py-1 text-right">AVERAGE</th><th className="border border-blue-200 px-2 py-1 text-right">STDEV.S</th></tr></thead>
                <tbody>{point.sensorResults.map((sensor: any) => (
                  <tr key={sensor.sensorIndex}><td className="border border-blue-100 px-2 py-1">{sensor.sensorLabel}</td><td className="border border-blue-100 px-2 py-1 text-right">{fmt(sensor.correctedMean, 8)}</td><td className="border border-blue-100 px-2 py-1 text-right">{fmt(sensor.stdev, 8)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p>
            สำหรับแต่ละรายการ uncertainty: <b>uᵢ = (Value ÷ Divisor) × Cᵢ</b>;
            จากนั้น <b>u<sub>c</sub> = √Σuᵢ² = {fmt(point.uc, 8)}</b>,
            <b> U = k × u<sub>c</sub> = {fmt(point.kp, 8)} × {fmt(point.uc, 8)} = {fmt(point.expandedU, 8)}</b>.
          </p>
          {stability && vertical && (
            <p className="text-gray-500">ค่าที่นำไปใช้ใน budget: Stability {fmt(stability.value, 8)} และ Vertical Uniformity {fmt(vertical.value, 8)}.</p>
          )}
        </div>
      </details>
    )
  }

  const newIsoResult = isoResult as IsoCalculationResult & {
    calPointResults?: Array<{
      point: number
      sensorResults?: Array<{ sensorIndex: number; sensorLabel: string; mean: number; stdev: number; correctedMean: number }>
      stability: number
      uniformity: number
      verticalUniformity?: number
      overallVariation: number
      indicatingReading?: number
      stdMean?: number
      correction?: number
      cmc?: number
      uncertaintyBudget: Array<{ key: string; name: string; value: number; divisor: number; ci: number; ui: number; vi: number }>
      uc: number
      kp: number
      expandedU: number
      reportedU: number
    }>
    timeCheckResult?: { avgUucTime: number; avgStdTime: number; timeDifference: number }
  }
  if (!Array.isArray((isoResult as any).sensorResults) && Array.isArray(newIsoResult.calPointResults)) {
    const methodLabel = (isoResult as any).methodCode || isoResult.isoMethodCode
    return (
      <div className="min-w-0 space-y-6">
        <h2 className="text-lg font-bold text-blue-800">ผลการคำนวณ ISO ({methodLabel})</h2>
        {newIsoResult.calPointResults.map((point) => {
          const isComparison = point.stdMean != null || point.correction != null
          return (
          <div key={point.point} className="card p-0 overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800">
              Cal. point: {point.point} · U = {fmt(point.reportedU, 4)} · k = {fmt(point.kp, 4)} · u<sub>c</sub> = {fmt(point.uc, 4)}
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {isComparison ? (
                <>
                  <div>Avg UUC: <b>{fmt(point.indicatingReading ?? point.sensorResults?.[0]?.mean ?? NaN, 4)}</b></div>
                  <div>Avg STD: <b>{fmt(point.stdMean ?? NaN, 4)}</b></div>
                  <div>Correction: <b>{fmt(point.correction ?? NaN, 4)}</b></div>
                  <div>CMC: <b>{fmt(point.cmc ?? NaN, 2)}</b></div>
                </>
              ) : (
                <>
                  <div>Stability: <b>{fmt(point.stability, 6)}</b></div>
                  <div>Uniformity: <b>{fmt(point.uniformity, 6)}</b></div>
                  <div>Vertical Uniformity: <b>{fmt(point.verticalUniformity ?? NaN, 6)}</b></div>
                  <div>Overall Variation: <b>{fmt(point.overallVariation, 6)}</b></div>
                  <div>UUC Reading: <b>{fmt(point.indicatingReading ?? NaN, 6)}</b></div>
                </>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-blue-800 text-white text-left">
                  <th className="py-2 px-2">Source</th><th className="py-2 px-2 text-right">Value</th><th className="py-2 px-2 text-right">Divisor</th><th className="py-2 px-2 text-right">Cᵢ</th><th className="py-2 px-2 text-right">uᵢ</th><th className="py-2 px-2 text-right">uᵢ²</th><th className="py-2 px-2 text-right">vᵢ</th>
                </tr></thead>
                <tbody>{point.uncertaintyBudget.map((source) => (
                  <tr key={source.key} className="border-b border-gray-100">
                    <td className="py-1.5 px-2">{source.name}</td><td className="py-1.5 px-2 text-right">{fmt(source.value, 8)}</td><td className="py-1.5 px-2 text-right">{fmt(source.divisor, 4)}</td><td className="py-1.5 px-2 text-right">{fmt(source.ci, 4)}</td><td className="py-1.5 px-2 text-right">{fmt(source.ui, 8)}</td><td className="py-1.5 px-2 text-right">{fmt(source.ui ** 2, 10)}</td><td className="py-1.5 px-2 text-right">{Number.isFinite(source.vi) ? fmt(source.vi, 2) : '∞'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <FormulaDetails point={point} />
          </div>
          )
        })}
        {newIsoResult.timeCheckResult && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800">
              ผลการตรวจสอบเวลา (Time Check)
            </div>
            <div className="p-4 text-sm space-y-1">
              <div>Avg UUC Time: <span className="font-medium">{fmt(newIsoResult.timeCheckResult.avgUucTime, 2)} s</span></div>
              <div>Avg STD Time: <span className="font-medium">{fmt(newIsoResult.timeCheckResult.avgStdTime, 2)} s</span></div>
              <div>Time Difference: <span className="font-medium">{fmt(newIsoResult.timeCheckResult.timeDifference, 2)} s</span></div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const { sensorResults, calPointSummaries, timeCheckResult, stdNo, stdName, unit } = isoResult
  const multiSensor = sensorResults.length > 1

  return (
    <div className="min-w-0 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-blue-800">
          ผลการคำนวณ ISO ({isoResult.isoMethodCode})
          {stdName ? <span className="font-normal text-gray-600"> — {stdName}</span> : null}
          {stdNo ? <span className="text-sm text-gray-500"> ({stdNo})</span> : null}
        </h2>
      </div>

      {/* Summary table */}
      {calPointSummaries.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800">
            สรุปผลการสอบเทียบ
          </div>
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-blue-800 text-white text-left">
                  <th className="py-2 px-2">Cal. Point</th>
                  {multiSensor && <th className="py-2 px-2">Sensor</th>}
                  <th className="py-2 px-2 text-right">Avg UUC</th>
                  <th className="py-2 px-2 text-right">Avg STD</th>
                  <th className="py-2 px-2 text-right">Correction</th>
                  <th className="py-2 px-2 text-right">u<sub>c</sub></th>
                  <th className="py-2 px-2 text-right">k</th>
                  <th className="py-2 px-2 text-right">U ({unit})</th>
                </tr>
              </thead>
              <tbody>
                {calPointSummaries.map((cps) =>
                  cps.sensorResults.map((sr, sIdx) => (
                    <tr key={`${cps.point}-${sIdx}`} className="border-b border-gray-100 even:bg-gray-50/50">
                      {sIdx === 0 ? (
                        <td className="py-1.5 px-2 font-medium" rowSpan={multiSensor ? cps.sensorResults.length : 1}>
                          {cps.point}
                        </td>
                      ) : null}
                      {multiSensor && <td className="py-1.5 px-2">S{sr.sensorIndex + 1}</td>}
                      <td className="py-1.5 px-2 text-right">{fmt(sr.avgUUC, 4)}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(sr.avgSTDRead, 4)}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(sr.correction, 4)}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(sr.uc, 6)}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(sr.k, 4)}</td>
                      <td className="py-1.5 px-2 text-right font-medium">{fmt(sr.U, 4)}</td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* Detailed budget per sensor */}
      {sensorResults.map((sr) => (
        <div key={sr.sensorIndex} className="space-y-4">
          {multiSensor && (
            <h3 className="text-base font-bold text-blue-700">Sensor {sr.sensorIndex + 1}</h3>
          )}
          {sr.calPointResults.map((pt, pi) => (
            <div key={pi} className="card p-0 overflow-hidden">
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800">
                Cal. point: {pt.point} · U = {fmt(pt.U, 4)} · k = {fmt(pt.k, 4)} · u<sub>c</sub> = {fmt(pt.uc, 4)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-blue-800 text-white text-left">
                      <th className="py-2 px-2">Symbol</th>
                      <th className="py-2 px-2 text-right">Value</th>
                      <th className="py-2 px-2 text-right">Divisor</th>
                      <th className="py-2 px-2 text-right">Ui(T)</th>
                      <th className="py-2 px-2 text-right">Ui(T)^2</th>
                      <th className="py-2 px-2 text-right">Vi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pt.components.map((c: UncertaintyComponent, i: number) => (
                      <tr key={i} className="border-b border-gray-100 even:bg-gray-50/50">
                        <td className="py-1.5 px-2 font-mono">{c.symbol}</td>
                        <td className="py-1.5 px-2 text-right">{fmt(c.value, 6)}</td>
                        <td className="py-1.5 px-2 text-right">{fmt(c.divisor, 4)}</td>
                        <td className="py-1.5 px-2 text-right font-medium">{fmt(c.ui, 6)}</td>
                        <td className="py-1.5 px-2 text-right">{fmt(c.ui2, 8)}</td>
                        <td className="py-1.5 px-2 text-right">{Number.isFinite(c.vi) ? fmt(c.vi, 2) : '∞'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Time check */}
      {timeCheckResult && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-sm font-semibold text-blue-800">
            ผลการตรวจสอบเวลา (Time Check)
          </div>
          <div className="p-4 text-sm space-y-1">
            <div>Avg UUC Time: <span className="font-medium">{fmt(timeCheckResult.avgUucTime, 2)} s</span></div>
            <div>Avg STD Time: <span className="font-medium">{fmt(timeCheckResult.avgStdTime, 2)} s</span></div>
            <div>Time Difference: <span className="font-medium">{fmt(timeCheckResult.timeDifference, 2)} s</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
