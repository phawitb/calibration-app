'use client'

import Link from 'next/link'

export default function RecordPreviewPanel({ recordId }: { recordId: string }) {
  return (
    <div className="card space-y-4">
      <h3 className="section-title">ตรวจสอบใบรับรอง (Preview)</h3>
      <p className="text-sm text-gray-600">
        ตรวจสอบข้อมูลใบรับรองก่อนขออนุมัติ คลิกปุ่มด้านล่างเพื่อดู PDF เต็มรูปแบบ
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        <iframe
          src={`/records/${recordId}/pdf?embed=1`}
          className="w-full border-0"
          style={{ height: '80vh', minHeight: '600px' }}
          title="Certificate Preview"
        />
      </div>
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
