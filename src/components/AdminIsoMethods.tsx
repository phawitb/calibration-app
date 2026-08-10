'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface MethodTemplate {
  _id: string
  code: string
  name: string
  nameTh: string
  deviceType: string
  measurementPattern: string
  unit: string
  procedureRef: string
  methodStandard: string
  isActive: boolean
  sortOrder: number
  gridConfig: any
  formFields: any[]
  uncertaintySources: any[]
  cmcTable: any[]
  correctionMethod: string
  hasTimeCheck: boolean
  hasCalRef: boolean
  hasPressure: boolean
  calibrationPlace: string
  referenceStandards: string[]
  hasLineVoltage: boolean
}

const PATTERN_LABELS: Record<string, string> = {
  comparison: 'เปรียบเทียบ (Comparison)',
  spatial_uniformity: 'ความสม่ำเสมอ (Spatial Uniformity)',
  comparison_with_ref_bath: 'เปรียบเทียบในอ่าง (Ref Bath)',
}

const CORRECTION_LABELS: Record<string, string> = {
  none: 'ไม่มี',
  linear_interpolation: 'Linear Interpolation',
  polynomial: 'Polynomial (a·x³+b·x²+c·x+d)',
}

export default function AdminIsoMethods() {
  const [methods, setMethods] = useState<MethodTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/iso-methods')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setMethods(Array.isArray(json.data) ? json.data : [])
    } catch (err) {
      toast.error('โหลดข้อมูลวิธีการ ISO ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMethods() }, [fetchMethods])

  const handleSeed = async () => {
    if (!confirm('ต้องการ seed/อัพเดทข้อมูลวิธีการ ISO จากค่ามาตรฐาน (Excel) หรือไม่?\n\nmethod ที่มีอยู่จะถูกอัพเดท, method ใหม่จะถูกเพิ่ม')) return
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/iso-methods/seed', { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message || 'Seed สำเร็จ')
        fetchMethods()
      } else {
        toast.error(json.error || 'Seed ไม่สำเร็จ')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSeeding(false)
    }
  }

  const toggleActive = async (method: MethodTemplate) => {
    try {
      const res = await fetch(`/api/admin/iso-methods/${method._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !method.isActive }),
      })
      if (res.ok) {
        toast.success(`${method.code} ${method.isActive ? 'ปิด' : 'เปิด'}ใช้งานแล้ว`)
        fetchMethods()
      }
    } catch {
      toast.error('อัพเดทไม่สำเร็จ')
    }
  }

  const deleteMethod = async (method: MethodTemplate) => {
    if (!confirm(`ต้องการลบ ${method.code} — ${method.nameTh}?`)) return
    try {
      const res = await fetch(`/api/admin/iso-methods/${method._id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('ลบสำเร็จ')
        fetchMethods()
      }
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  if (loading) {
    return <div className="card text-center text-gray-500 py-8">กำลังโหลด...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-military-900">วิธีการสอบเทียบ ISO</h2>
          <p className="text-sm text-gray-600 mt-1">
            จัดการ method templates สำหรับงาน ISO — uncertainty sources, CMC, form fields, grid config
          </p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="btn-primary text-sm px-4"
        >
          {seeding ? 'กำลัง Seed...' : methods.length === 0 ? 'Seed ข้อมูลเริ่มต้น' : 'Sync จาก Excel'}
        </button>
      </div>

      {methods.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-gray-500">ยังไม่มี method template</p>
          <p className="text-sm text-gray-400">กดปุ่ม &quot;Seed ข้อมูลเริ่มต้น&quot; เพื่อนำเข้าวิธีการจาก Excel</p>
        </div>
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m._id} className={`card border ${m.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => setExpandedId(expandedId === m._id ? null : m._id)}>
                  <span className="text-xs font-mono px-2 py-0.5 bg-military-100 text-military-800 rounded">
                    {m.code}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.nameTh}</p>
                    <p className="text-xs text-gray-500">{m.name} — {m.deviceType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    m.measurementPattern === 'comparison' ? 'bg-blue-100 text-blue-700' :
                    m.measurementPattern === 'spatial_uniformity' ? 'bg-green-100 text-green-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {PATTERN_LABELS[m.measurementPattern] || m.measurementPattern}
                  </span>
                  <span className="text-xs text-gray-400">{m.unit}</span>
                  <button onClick={() => toggleActive(m)}
                    className={`text-xs px-2 py-0.5 rounded ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => deleteMethod(m)}
                    className="text-xs text-red-400 hover:text-red-600 px-1">
                    ลบ
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === m._id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 text-xs">
                  {/* Basic info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-gray-400">Procedure</p>
                      <p className="font-medium">{m.procedureRef || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Method Standard</p>
                      <p className="font-medium">{m.methodStandard || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Correction</p>
                      <p className="font-medium">{CORRECTION_LABELS[m.correctionMethod] || m.correctionMethod}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Calibration Place</p>
                      <p className="font-medium">{m.calibrationPlace === 'both' ? 'In-lab / Onsite' : 'Onsite only'}</p>
                    </div>
                  </div>

                  {/* Grid config */}
                  <div>
                    <p className="text-gray-400 font-medium mb-1">Grid Config</p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-gray-50 rounded p-2">
                      <div><span className="text-gray-400">Sensors:</span> {m.gridConfig?.sensorCountFixed ?? `${m.gridConfig?.sensorCountMin}-${m.gridConfig?.sensorCountMax}`}</div>
                      <div><span className="text-gray-400">Readings/pt:</span> {m.gridConfig?.readingsPerPoint}</div>
                      <div><span className="text-gray-400">Default pts:</span> {m.gridConfig?.defaultCalPoints}</div>
                      <div><span className="text-gray-400">STD col:</span> {m.gridConfig?.hasStdReadingColumn ? 'Yes' : 'No'}</div>
                      <div><span className="text-gray-400">Dynamic:</span> {m.gridConfig?.sensorCountDynamic ? 'Yes' : 'No'}</div>
                      <div><span className="text-gray-400">Dual ch:</span> {m.gridConfig?.hasDualChannel ? 'Yes' : 'No'}</div>
                    </div>
                    {m.gridConfig?.sensorLabels?.length > 0 && (
                      <p className="text-gray-400 mt-1">Labels: {m.gridConfig.sensorLabels.join(', ')}</p>
                    )}
                  </div>

                  {/* Features */}
                  <div className="flex gap-2">
                    {m.hasTimeCheck && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">Time Check</span>}
                    {m.hasCalRef && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded">Cal Ref</span>}
                    {m.hasPressure && <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded">Pressure</span>}
                    {m.hasLineVoltage && <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded">Line Voltage</span>}
                  </div>

                  {/* Reference standards */}
                  {m.referenceStandards?.length > 0 && (
                    <div>
                      <p className="text-gray-400 font-medium mb-1">Reference Standards</p>
                      <div className="flex gap-1">
                        {m.referenceStandards.map((rs) => (
                          <span key={rs} className="px-2 py-0.5 bg-gray-100 rounded text-gray-700">{rs}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CMC Table */}
                  {m.cmcTable?.length > 0 && (
                    <div>
                      <p className="text-gray-400 font-medium mb-1">CMC Table</p>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-200 px-2 py-1 text-left">Range</th>
                            <th className="border border-gray-200 px-2 py-1 text-right">CMC ({m.unit})</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.cmcTable.map((row, i) => (
                            <tr key={i}>
                              <td className="border border-gray-200 px-2 py-1">{row.label || `${row.rangeMin} ~ ${row.rangeMax}`}</td>
                              <td className="border border-gray-200 px-2 py-1 text-right font-mono">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Uncertainty Sources */}
                  {m.uncertaintySources?.length > 0 && (
                    <div>
                      <p className="text-gray-400 font-medium mb-1">Uncertainty Sources ({m.uncertaintySources.length})</p>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-200 px-2 py-1 text-left">Key</th>
                              <th className="border border-gray-200 px-2 py-1 text-left">Name</th>
                              <th className="border border-gray-200 px-2 py-1">Type</th>
                              <th className="border border-gray-200 px-2 py-1">Distribution</th>
                              <th className="border border-gray-200 px-2 py-1">Divisor</th>
                              <th className="border border-gray-200 px-2 py-1">Ci</th>
                              <th className="border border-gray-200 px-2 py-1 text-left">Value Source</th>
                              <th className="border border-gray-200 px-2 py-1">DOF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {m.uncertaintySources
                              .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                              .map((us: any) => (
                              <tr key={us.key} className={us.enabled ? '' : 'opacity-40'}>
                                <td className="border border-gray-200 px-2 py-1 font-mono">{us.key}</td>
                                <td className="border border-gray-200 px-2 py-1">{us.nameTh || us.name}</td>
                                <td className="border border-gray-200 px-2 py-1 text-center">
                                  <span className={`px-1.5 py-0.5 rounded ${us.type === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {us.type}
                                  </span>
                                </td>
                                <td className="border border-gray-200 px-2 py-1 text-center">{us.distribution}</td>
                                <td className="border border-gray-200 px-2 py-1 text-center font-mono">{us.divisor?.toFixed(3)}</td>
                                <td className="border border-gray-200 px-2 py-1 text-center">{us.sensitivityCoefficient}</td>
                                <td className="border border-gray-200 px-2 py-1">
                                  <span className="text-gray-500">{us.valueSource?.type}</span>
                                  {us.valueSource?.fixedValue != null && <span className="ml-1 font-mono">= {us.valueSource.fixedValue}</span>}
                                  {us.valueSource?.stdField && <span className="ml-1 text-blue-600">.{us.valueSource.stdField}</span>}
                                  {us.valueSource?.target && <span className="ml-1 text-purple-600">({us.valueSource.target})</span>}
                                  {us.valueSource?.multiplier && <span className="ml-1 text-green-600">x{us.valueSource.multiplier}</span>}
                                </td>
                                <td className="border border-gray-200 px-2 py-1 text-center">
                                  {us.degreesOfFreedom === 'infinity' ? '∞' : us.degreesOfFreedom}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Form fields */}
                  {m.formFields?.length > 0 && (
                    <div>
                      <p className="text-gray-400 font-medium mb-1">Form Fields ({m.formFields.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {m.formFields.map((ff: any) => (
                          <span key={ff.key} className="px-2 py-1 bg-gray-50 rounded border border-gray-200">
                            <span className="font-mono text-gray-600">{ff.key}</span>
                            <span className="text-gray-400 ml-1">({ff.type})</span>
                            {ff.required && <span className="text-red-400 ml-0.5">*</span>}
                            {ff.group && <span className="text-blue-400 ml-1">[{ff.group}]</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
