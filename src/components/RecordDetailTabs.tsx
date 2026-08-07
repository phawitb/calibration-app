'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'edit' | 'calc' | 'history'

export default function RecordDetailTabs({
  children,
  calcPanel,
  historyPanel,
}: {
  children: React.ReactNode
  calcPanel: ReactNode
  historyPanel?: ReactNode
}) {
  const [tab, setTab] = useState<Tab>('edit')
  /** โหลด/เมานต์ panel คำนวณเมื่อผู้ใช้เปิดแท็บครั้งแรก — กัน request หนักทุกครั้งที่เข้าหน้า */
  const [calcMounted, setCalcMounted] = useState(false)
  const [historyMounted, setHistoryMounted] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-military-200" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'edit'}
          onClick={() => setTab('edit')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'edit'
              ? 'bg-military-800 text-white'
              : 'text-military-700 hover:bg-military-50'
          }`}
        >
          แก้ไขข้อมูล
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'calc'}
          onClick={() => {
            setCalcMounted(true)
            setTab('calc')
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'calc'
              ? 'bg-military-800 text-white'
              : 'text-military-700 hover:bg-military-50'
          }`}
        >
          ผลการคำนวณ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => {
            setHistoryMounted(true)
            setTab('history')
          }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'history'
              ? 'bg-military-800 text-white'
              : 'text-military-700 hover:bg-military-50'
          }`}
        >
          ประวัติอาร์เมดนี้
        </button>
      </div>
      {/* ซ่อนแทน unmount ฟอร์ม — กัน layout เละ / state หายเวลาสลับแท็บ */}
      <div className={tab === 'edit' ? 'block space-y-4 min-w-0' : 'hidden'} aria-hidden={tab !== 'edit'}>
        {children}
      </div>
      {calcMounted && (
        <div
          className={tab === 'calc' ? 'block space-y-4 min-w-0' : 'hidden'}
          aria-hidden={tab !== 'calc'}
        >
          {calcPanel}
        </div>
      )}
      {historyMounted && historyPanel && (
        <div
          className={tab === 'history' ? 'block space-y-4 min-w-0' : 'hidden'}
          aria-hidden={tab !== 'history'}
        >
          {historyPanel}
        </div>
      )}
    </div>
  )
}
