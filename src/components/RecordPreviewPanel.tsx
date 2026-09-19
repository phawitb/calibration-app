'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">กำลังโหลดตัวอย่าง PDF…</p>
    </div>
  ),
})

export default function RecordPreviewPanel({ recordId, record }: { recordId: string; record: any }) {
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-title">ตรวจสอบใบรับรอง (Preview)</h3>
        <Link href={`/records/${recordId}/pdf`} className="btn-secondary text-sm">
          Export PDF
        </Link>
      </div>
      <PdfViewer record={record} recordId={recordId} />
    </div>
  )
}
