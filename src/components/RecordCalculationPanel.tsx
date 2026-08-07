'use client'

import { useEffect, useState } from 'react'
import { fmt } from '@/lib/uncertainty'
import type { UcComponentResult, UncertaintyComponent } from '@/lib/uncertainty'

type CalculateResponse = {
  ucResults: Record<string, UcComponentResult | undefined>
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
          setData({ ucResults: j.ucResults })
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

  const order = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'] as const
  const blocks = order
    .map((k) => ({ key: k, uc: data.ucResults[k] }))
    .filter((b) => b.uc && (b.uc.points || []).length > 0)

  if (blocks.length === 0) {
    return <p className="text-gray-500 text-sm">ยังไม่มีข้อมูล Uc สำหรับคำนวณ</p>
  }

  return (
    <div className="min-w-0 space-y-8">
      {blocks.map(({ key, uc }) => (
        <div key={key} className="space-y-4">
          <h2 className="text-lg font-bold text-military-800">
            {key.toUpperCase()}{' '}
            {uc?.stdName ? <span className="font-normal text-gray-600">— {uc.stdName}</span> : null}
            {uc?.unit ? <span className="text-sm text-gray-500"> ({uc.measurement} · {uc.unit})</span> : null}
          </h2>
          {(uc?.points || []).map((pt, pi) => (
            <div key={pi} className="card p-0 overflow-hidden">
              <div className="px-4 py-2 bg-military-50 border-b border-military-100 text-sm font-semibold text-military-800">
                Cal. point: {pt.point} · U = {fmt(pt.U, 4)} · k = {fmt(pt.k, 4)} · u<sub>c</sub> = {fmt(pt.uc, 4)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-military-800 text-white text-left">
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
    </div>
  )
}
