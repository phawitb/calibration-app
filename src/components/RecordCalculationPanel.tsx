'use client'

import { useEffect, useState } from 'react'
import { fmt } from '@/lib/uncertainty'
import type { UcComponentResult, CalPointResult, UncertaintyComponent, IsoCalculationResult } from '@/lib/uncertainty'

type CalculateResponse = {
  calibrationType?: 'sbcal' | 'iso'
  ucResults?: Record<string, UcComponentResult | undefined>
  isoResult?: IsoCalculationResult | null
}

function CalPointBlock({ pt, ucLabel, index }: { pt: CalPointResult; ucLabel: string; index: number }) {
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
              <td className="py-1 px-2 font-medium text-right">{fmt(pt.avgUUC, 4)}</td>
            </tr>
            {/* Row 2: Calpoint */}
            <tr className="bg-yellow-50 border-b border-yellow-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>Calpoint{index}</td>
              <td className="py-1 px-2 font-medium" colSpan={n}>{pt.point}</td>
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">-uT Rep(UUC)</td>
              <td className="py-1 px-2 font-medium text-right">{fmt(pt.uTRepUUC, 10)}</td>
            </tr>
            {/* Row 3: N headers */}
            <tr className="border-b border-gray-200">
              <td className="py-1 px-2 font-medium text-center" colSpan={2}>N</td>
              {Array.from({ length: n }, (_, i) => (
                <td key={i} className="py-1 px-2 text-center font-medium">{i + 1}</td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">- Avg.STD</td>
              <td className="py-1 px-2 font-medium text-right">{fmt(pt.avgSTD, 4)}</td>
            </tr>
            {/* Row 4: UUC Read */}
            <tr className="bg-yellow-50 border-b border-yellow-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>UUC Read</td>
              {(pt.uucReadings || []).map((v, i) => (
                <td key={i} className="py-1 px-2 text-center">{v}</td>
              ))}
              {Array.from({ length: Math.max(0, n - (pt.uucReadings?.length || 0)) }, (_, i) => (
                <td key={`e${i}`} className="py-1 px-2"></td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">-StdCorrection</td>
              <td className="py-1 px-2 font-medium text-right">{fmt(pt.stdCorrection, 4)}</td>
            </tr>
            {/* Row 5: STD Read */}
            <tr className="border-b border-gray-200">
              <td className="py-1 px-2 font-semibold text-military-800" colSpan={2}>STD Read</td>
              {(pt.stdReadings || []).map((v, i) => (
                <td key={i} className="py-1 px-2 text-center">{v}</td>
              ))}
              {Array.from({ length: Math.max(0, n - (pt.stdReadings?.length || 0)) }, (_, i) => (
                <td key={`e${i}`} className="py-1 px-2"></td>
              ))}
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200 bg-yellow-50">- AvgSTDRead</td>
              <td className="py-1 px-2 font-medium text-right bg-yellow-50">{fmt(pt.avgSTDRead, 4)}</td>
            </tr>
            {/* Row 6: uT Rep.(STD) */}
            <tr className="border-b border-gray-300">
              <td colSpan={n + 2}></td>
              <td className="py-1 px-2 text-gray-600 border-r border-gray-200">- uT Rep.(STD)</td>
              <td className="py-1 px-2 font-medium text-right">{fmt(pt.uTRepSTD, 10)}</td>
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
              <td className="py-1 px-2 text-right">{fmt(pt.uc, 10)}</td>
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
              <td className="py-1 px-2 text-right">{fmt(pt.U, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.k, 10)}</td>
              <td className="py-1 px-2 text-right">{fmt(pt.k, 10)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RecordCalculationPanel({ recordId }: { recordId: string }) {
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

  // ISO calculation result
  if (data.calibrationType === 'iso') {
    return <IsoResultPanel isoResult={data.isoResult} />
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
