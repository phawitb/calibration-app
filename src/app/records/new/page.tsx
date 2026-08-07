import CalibrationForm from '@/components/CalibrationForm'
import Link from 'next/link'

export default function NewRecordPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/records" className="text-gray-400 hover:text-gray-600 transition-colors">
          ← ข้อมูลสอบเทียบ
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-military-900">เพิ่มข้อมูลใหม่</h1>
      </div>
      <CalibrationForm mode="create" />
    </div>
  )
}
