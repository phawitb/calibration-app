'use client'

import { normalizeMpeUnit, type MpeUnit } from '@/lib/acceptance'

export type CalPriceRefLike = { device?: string; calPrice?: number; mainPrice?: number; mpe?: number | string | null; mpeUnit?: string | null }

/** หาแถว calprices ที่ชื่อเครื่องมือตรงกับ deviceName (ช่อง device คั่นด้วยจุลภาคได้) */
export function matchCalPriceRef<T extends CalPriceRefLike>(refs: T[], deviceName: unknown): T | undefined {
  const devNorm = String(deviceName ?? '').trim().toLowerCase()
  if (!devNorm) return undefined
  return refs.find((p) => {
    const devList = String(p.device || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    return devList.some((dv) => dv === devNorm || devNorm.includes(dv) || dv.includes(devNorm))
  })
}

/** ค่าเกณฑ์ตั้งต้นจากแถว calprices (ว่างเมื่อไม่ได้ตั้งค่าไว้) */
export function acceptanceDefaultsFromRef(ref: CalPriceRefLike | undefined): { mpe: number; mpeUnit: MpeUnit } | null {
  if (!ref || ref.mpe === '' || ref.mpe == null) return null
  const mpe = Number(ref.mpe)
  if (!Number.isFinite(mpe) || mpe < 0) return null
  return { mpe, mpeUnit: normalizeMpeUnit(ref.mpeUnit) }
}

type AcceptanceState = { mpe?: number | string | null; mpeUnit?: string | null; includeUncertainty?: boolean | null; note?: string | null }

/**
 * ประเภทงาน (สอบเทียบ/ทดสอบ) + ทดสอบความปลอดภัยทางไฟฟ้า + เกณฑ์การยอมรับ (MPE)
 * ฟิลด์ payload: serviceType, electricalSafetyTest, acceptance{mpe, mpeUnit, includeUncertainty, note}
 */
export default function ServiceAcceptanceCard({
  data,
  onChange,
  prefilledFrom,
}: {
  data: { serviceType?: string; electricalSafetyTest?: boolean; acceptance?: AcceptanceState | null }
  onChange: (patch: Record<string, unknown>) => void
  /** ชื่อเครื่องมือในตาราง calprices ที่ใช้เติมค่าตั้งต้น (แสดงเป็นคำอธิบาย) */
  prefilledFrom?: string
}) {
  const acceptance: AcceptanceState = data.acceptance || {}
  const setAcceptance = (patch: Partial<AcceptanceState>) => onChange({ acceptance: { ...acceptance, ...patch } })
  const serviceType = data.serviceType === 'test' ? 'test' : 'calibrate'

  return (
    <div className="card space-y-4" data-testid="service-acceptance-card">
      <h3 className="section-title">ประเภทงานและเกณฑ์การยอมรับ</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="service-type" className="block text-sm font-medium text-gray-700 mb-1">ประเภทงาน</label>
          <select
            id="service-type"
            className="input-field"
            value={serviceType}
            onChange={(e) => onChange({ serviceType: e.target.value === 'test' ? 'test' : 'calibrate' })}
          >
            <option value="calibrate">สอบเทียบ (Calibration)</option>
            <option value="test">ทดสอบ (Test)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">มีผลต่อหัวเรื่องใบรับรอง/รายงานผล</p>
        </div>
        <div className="flex items-start gap-2 sm:pt-7">
          <input
            type="checkbox"
            id="electrical-safety-test"
            checked={!!data.electricalSafetyTest}
            onChange={(e) => onChange({ electricalSafetyTest: e.target.checked })}
            className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <label htmlFor="electrical-safety-test" className="text-sm font-medium text-gray-700">
            ทดสอบความปลอดภัยทางไฟฟ้า (Electrical Safety Test)
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-semibold text-military-800">เกณฑ์การยอมรับ (MPE)</h4>
          <p className="text-xs text-gray-500">
            ระบบตัดสิน ผ่าน/ไม่ผ่าน ต่อจุดจาก |ค่าคลาดเคลื่อน| เทียบ MPE — เว้นว่างเพื่อให้ผลเป็น N/A
            {prefilledFrom ? ` (ค่าตั้งต้นจากตารางราคา: ${prefilledFrom})` : ''}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="acceptance-mpe" className="block text-sm font-medium text-gray-700 mb-1">ค่า MPE (±)</label>
            <input
              id="acceptance-mpe"
              type="number"
              step="any"
              min={0}
              className="input-field"
              value={acceptance.mpe ?? ''}
              onChange={(e) => setAcceptance({ mpe: e.target.value === '' ? '' : Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="acceptance-mpe-unit" className="block text-sm font-medium text-gray-700 mb-1">หน่วยของ MPE</label>
            <select
              id="acceptance-mpe-unit"
              className="input-field"
              value={normalizeMpeUnit(acceptance.mpeUnit)}
              onChange={(e) => setAcceptance({ mpeUnit: normalizeMpeUnit(e.target.value) })}
            >
              <option value="abs">ค่าสัมบูรณ์ (หน่วยเดียวกับค่าวัด)</option>
              <option value="percent">% ของค่าอ้างอิง</option>
            </select>
          </div>
          <div className="flex items-start gap-2 sm:pt-7">
            <input
              type="checkbox"
              id="acceptance-include-u"
              checked={!!acceptance.includeUncertainty}
              onChange={(e) => setAcceptance({ includeUncertainty: e.target.checked })}
              className="h-4 w-4 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="acceptance-include-u" className="text-sm font-medium text-gray-700">
              รวมค่าความไม่แน่นอน U ก่อนเทียบเกณฑ์
            </label>
          </div>
          <div>
            <label htmlFor="acceptance-note" className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุเกณฑ์</label>
            <input
              id="acceptance-note"
              type="text"
              className="input-field"
              placeholder="เช่น ตามคู่มือผู้ผลิต"
              value={acceptance.note ?? ''}
              onChange={(e) => setAcceptance({ note: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
