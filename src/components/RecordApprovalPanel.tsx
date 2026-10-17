'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatApproverOption } from '@/lib/recordPersonnel'
import { promptApprovalPin } from '@/components/ApprovalPinDialog'
import { evaluateEnvironment, type EnvironmentRecordLike } from '@/lib/environmentCheck'
import { useEnvironmentConfig } from '@/hooks/useEnvironmentConfig'

/** บรรทัดสถานะสภาวะแวดล้อม (อุณหภูมิ/ความชื้น เทียบช่วงที่ใช้ตัดสิน) */
export function EnvironmentStatusLine({ record }: { record: EnvironmentRecordLike }) {
  const config = useEnvironmentConfig()
  const ev = evaluateEnvironment(record, config)
  const bound = (b: typeof ev.temp) =>
    `${b.label} ${b.value == null ? '—' : b.value} ${b.unit} (เกณฑ์ ${b.min}–${b.max} ${b.unit}${b.source === 'std1' ? ' จาก Std1' : ''})`
  return (
    <p className={`text-sm ${ev.ok ? 'text-emerald-700' : 'text-red-700'}`} data-testid="environment-status">
      <span className="font-semibold">{ev.ok ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์'} สภาวะแวดล้อม</span>
      {' — '}
      {bound(ev.temp)}, {bound(ev.humid)}
      {!ev.required && !ev.ok && <span className="text-gray-500"> (ระบบไม่บังคับตรวจ)</span>}
    </p>
  )
}

interface Approver {
  _id: string
  fullName?: string
  name?: string
  rank?: string
  fullNameEn?: string
  rankEn?: string
  role?: string
}

export default function RecordApprovalPanel({
  recordId,
  approvalStatus,
  requestedApproverId,
  record,
}: {
  recordId: string
  approvalStatus?: string
  requestedApproverId?: string
  /** ค่าสภาวะแวดล้อมของ record (lapTemp/lapHumid/std1) สำหรับตรวจเกณฑ์ก่อนส่งขออนุมัติ */
  record?: EnvironmentRecordLike | null
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const role = (session?.user as any)?.role as string | undefined
  const canSubmit = role === 'admin' || role === 'technician'
  const envConfig = useEnvironmentConfig()
  const envEvaluation = record ? evaluateEnvironment(record, envConfig) : null
  const envBlocked = !!envEvaluation && envEvaluation.required && !envEvaluation.ok

  const [approvers, setApprovers] = useState<Approver[]>([])
  const [selectedApproverId, setSelectedApproverId] = useState(
    requestedApproverId || ''
  )
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    setSelectedApproverId(requestedApproverId || '')
  }, [recordId, requestedApproverId])

  const isApproved = approvalStatus === 'approved'
  const isPending = approvalStatus === 'pending_approval'

  useEffect(() => {
    if (!canSubmit) return
    let mounted = true
    fetch('/api/users/approvers')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (mounted && json?.users) {
          setApprovers(json.users)
          // Default to first approver if none selected
          if (!selectedApproverId && json.users.length > 0) {
            setSelectedApproverId(json.users[0]._id)
          }
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [canSubmit])

  const handleRequestApproval = async () => {
    if (!selectedApproverId) {
      toast.error('กรุณาเลือกผู้อนุมัติ')
      return
    }
    if (submitting) return
    // TOR 1.2.1.14: ส่งขออนุมัติครั้งแรกต้องยืนยันด้วย PIN ส่วนตัว (เปลี่ยนผู้อนุมัติระหว่างรอไม่ต้อง)
    let approvalPin: string | null = null
    if (!isPending) {
      approvalPin = await promptApprovalPin()
      if (approvalPin == null) return
    }
    setSubmitting(true)
    try {
      const selectedApprover = approvers.find(
        (a) => a._id === selectedApproverId
      )
      const approverName = selectedApprover
        ? (
            selectedApprover.fullNameEn ||
            selectedApprover.fullName ||
            selectedApprover.name ||
            ''
          ).trim()
        : ''

      const res = await fetch(
        `/api/records/${recordId}${isPending ? '/approver' : ''}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            saveAction: 'request_approval',
            requestedApproverId: selectedApproverId,
            requestedApproverName: approverName,
            ...(approvalPin ? { approvalPin } : {}),
          }),
        }
      )
      if (res.ok) {
        toast.success(
          isPending ? 'เปลี่ยนผู้รับคำขออนุมัติแล้ว' : 'ส่งขออนุมัติใบเซอร์แล้ว'
        )
        router.refresh()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'เกิดข้อผิดพลาด')
        if (res.status === 409) router.refresh()
      }
    } catch {
      toast.error('ไม่สามารถบันทึกได้ กรุณาลองใหม่')
    } finally {
      setSubmitting(false)
    }
  }

  if (isApproved) {
    return (
      <div className="card border border-emerald-300 bg-emerald-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-emerald-800">
              ใบรับรองนี้ได้รับอนุมัติแล้ว
            </p>
            <p className="text-sm text-emerald-600">
              สามารถ Export PDF ฉบับเต็มได้
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (isPending && !canSubmit) {
    return (
      <div className="card border border-amber-300 bg-amber-50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="font-semibold text-amber-800">
              ส่งขออนุมัติแล้ว รอผู้อนุมัติดำเนินการ
            </p>
            <p className="text-sm text-amber-600">
              สถานะจะอัพเดทเมื่อผู้อนุมัติกดอนุมัติ
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!canSubmit) return null

  return (
    <div className="card border-2 border-amber-400 bg-amber-50/50 space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{isPending ? '⏳' : '📋'}</span>
        <div>
          <p className="font-semibold text-military-800">
            {isPending ? 'รายการนี้อยู่ระหว่างรออนุมัติ' : 'ขออนุมัติใบเซอร์'}
          </p>
          <p className="text-sm text-gray-600">
            {isPending
              ? 'สามารถเปลี่ยนผู้รับคำขออนุมัติได้ โดยรายการยังคงอยู่ในสถานะรออนุมัติ'
              : 'ตรวจสอบข้อมูลและผลคำนวณเรียบร้อยแล้ว เลือกผู้อนุมัติแล้วกดส่ง'}
          </p>
        </div>
      </div>
      {record && <EnvironmentStatusLine record={record} />}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            เลือกผู้อนุมัติ
          </label>
          <select
            aria-label="เลือกผู้อนุมัติ"
            disabled={submitting}
            className="input-field"
            value={selectedApproverId}
            onChange={(e) => setSelectedApproverId(e.target.value)}
          >
            <option value="">-- เลือกผู้อนุมัติ --</option>
            {approvers.map((a) => (
              <option key={a._id} value={a._id}>
                {formatApproverOption(a)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={
            submitting ||
            (envBlocked && !isPending) ||
            !approvers.some((a) => a._id === selectedApproverId) ||
            (isPending && selectedApproverId === requestedApproverId)
          }
          title={envBlocked && !isPending ? envEvaluation?.message : undefined}
          onClick={handleRequestApproval}
          className={`px-6 py-2 rounded-lg font-semibold text-gray-900 whitespace-nowrap ${
            submitting || !selectedApproverId || (envBlocked && !isPending)
              ? 'bg-amber-300 cursor-not-allowed'
              : 'bg-amber-500 hover:bg-amber-600'
          }`}
        >
          {submitting
            ? 'กำลังบันทึก...'
            : isPending
              ? 'บันทึกผู้อนุมัติใหม่'
              : 'ส่งขออนุมัติ'}
        </button>
      </div>
    </div>
  )
}
