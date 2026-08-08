'use client'

import { useState, useCallback, useRef, type ReactNode } from 'react'
import { StepNavContext } from '@/lib/stepNavContext'

type Tab = 'edit' | 'calc' | 'preview' | 'history'

const STEPS = [
  { key: 'edit' as Tab, label: 'กรอกข้อมูล', num: 1 },
  { key: 'calc' as Tab, label: 'คำนวณ', num: 2 },
  { key: 'preview' as Tab, label: 'ตรวจสอบ / PDF', num: 3 },
]

const APPROVAL_STEPS = [
  { key: 'pending' as const, label: 'รออนุมัติ', num: 4 },
  { key: 'approved' as const, label: 'สำเร็จ', num: 5 },
]

function persistStep(recordId: string | undefined, step: string) {
  if (!recordId) return
  fetch(`/api/records/${recordId}/step`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step }),
  }).catch(() => {})
}

export default function RecordDetailTabs({
  children,
  calcPanel,
  previewPanel,
  historyPanel,
  approvalPanel,
  approvalStatus,
  recordId,
  initialStep,
}: {
  children: React.ReactNode
  calcPanel: ReactNode
  previewPanel?: ReactNode
  historyPanel?: ReactNode
  approvalPanel?: ReactNode
  approvalStatus?: string
  recordId?: string
  initialStep?: string
}) {
  const validInitial = (['edit', 'calc', 'preview'] as Tab[]).includes(initialStep as Tab)
    ? (initialStep as Tab)
    : 'edit'
  const [tab, setTab] = useState<Tab>(validInitial)
  const [calcMounted, setCalcMounted] = useState(validInitial === 'calc' || validInitial === 'preview')
  const [previewMounted, setPreviewMounted] = useState(validInitial === 'preview')
  const [historyMounted, setHistoryMounted] = useState(false)

  const isApproved = approvalStatus === 'approved'
  const isPending = approvalStatus === 'pending_approval'

  const changeTab = useCallback((next: Tab) => {
    if (next === 'calc') setCalcMounted(true)
    if (next === 'preview') { setCalcMounted(true); setPreviewMounted(true) }
    if (next === 'history') setHistoryMounted(true)
    setTab(next)
    // Persist step (only for main steps, not history)
    if (next !== 'history') persistStep(recordId, next)
  }, [recordId])

  return (
    <div className="space-y-4">
      {/* Step progress bar */}
      <div className="card py-3 px-4">
        <div className="flex items-center gap-0">
          {STEPS.map((step, i, arr) => {
            const isActive = tab === step.key
            const stepDone =
              step.key === 'edit' ? true :
              step.key === 'calc' ? calcMounted :
              step.key === 'preview' ? (isPending || isApproved) : false

            return (
              <div key={step.key} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => changeTab(step.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-military-700 text-white'
                      : stepDone
                        ? 'text-emerald-700 hover:bg-emerald-50'
                        : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isActive
                      ? 'bg-white text-military-700'
                      : stepDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {stepDone && !isActive ? '✓' : step.num}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                <div className={`flex-1 h-0.5 mx-1 rounded ${stepDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              </div>
            )
          })}

          {/* Approval status steps (non-clickable) */}
          {APPROVAL_STEPS.map((step, i) => {
            const isDone =
              step.key === 'pending' ? (isPending || isApproved) :
              step.key === 'approved' ? isApproved : false
            const isCurrent =
              step.key === 'pending' ? isPending :
              step.key === 'approved' ? isApproved : false

            return (
              <div key={step.key} className={`flex items-center ${i < APPROVAL_STEPS.length - 1 ? 'flex-1' : 'flex-none'}`}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                  isCurrent
                    ? step.key === 'approved'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                    : isDone
                      ? 'text-emerald-700'
                      : 'text-gray-400'
                }`}>
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isCurrent
                      ? step.key === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isDone ? '✓' : isCurrent && step.key === 'pending' ? '⏳' : step.num}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < APPROVAL_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}

          {/* History tab - separate, right-aligned */}
          <div className="ml-auto pl-2">
            <button
              type="button"
              onClick={() => changeTab('history')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'history'
                  ? 'bg-military-700 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span className="hidden sm:inline">ประวัติ</span>
              <span className="sm:hidden">📜</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {isPending && (
        <div className="card border border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-2 py-3">
          <span className="text-lg">⏳</span>
          <span className="font-medium">รายการนี้อยู่ระหว่างรออนุมัติ</span>
        </div>
      )}
      {isApproved && (
        <div className="card border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center gap-2 py-3">
          <span className="text-lg">✅</span>
          <span className="font-medium">รายการนี้อนุมัติแล้ว</span>
        </div>
      )}

      {/* Tab: Edit */}
      <div className={tab === 'edit' ? 'block space-y-4 min-w-0' : 'hidden'} aria-hidden={tab !== 'edit'}>
        <StepNavContext.Provider value={{ goToNext: () => changeTab('calc') }}>
          {children}
        </StepNavContext.Provider>
      </div>

      {/* Tab: Calc */}
      {calcMounted && (
        <div className={tab === 'calc' ? 'block space-y-4 min-w-0' : 'hidden'} aria-hidden={tab !== 'calc'}>
          {calcPanel}
          <div className="card bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => changeTab('edit')} className="btn-secondary text-sm flex items-center gap-1.5">
                <span>&larr;</span> แก้ไขข้อมูล
              </button>
              <button type="button" onClick={() => changeTab('preview')}
                className="btn-primary text-sm flex items-center gap-1.5">
                ตรวจสอบ / PDF <span>&rarr;</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Preview + Approval */}
      {previewMounted && (
        <div className={tab === 'preview' ? 'block space-y-4 min-w-0' : 'hidden'} aria-hidden={tab !== 'preview'}>
          {previewPanel}
          {approvalPanel && (
            <div className="mt-4">
              {approvalPanel}
            </div>
          )}
          <div className="card bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => changeTab('calc')} className="btn-secondary text-sm flex items-center gap-1.5">
                <span>&larr;</span> ผลคำนวณ
              </button>
              <div className="text-sm text-gray-500">
                {isApproved ? '✅ อนุมัติแล้ว' : isPending ? '⏳ รออนุมัติ — ผู้อนุมัติจะได้รับแจ้ง' : 'เลือกผู้อนุมัติด้านบนเพื่อส่งขออนุมัติ'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: History */}
      {historyMounted && historyPanel && (
        <div className={tab === 'history' ? 'block space-y-4 min-w-0' : 'hidden'} aria-hidden={tab !== 'history'}>
          {historyPanel}
        </div>
      )}
    </div>
  )
}
