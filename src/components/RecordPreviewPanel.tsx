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
      <h3 className="section-title">ตรวจสอบใบรับรอง (Preview)</h3>
      <PdfViewer record={record} recordId={recordId} />
      <div className="flex justify-center">
        <Link
          href={`/records/${recordId}/pdf`}
          target="_blank"
          className="btn-secondary text-sm flex items-center gap-2"
        >
          เปิด PDF ในหน้าใหม่
        </Link>
      </div>
    </div>
  )
}
