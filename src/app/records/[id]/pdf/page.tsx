import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const PdfViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 card">
      <p className="text-gray-500">กำลังโหลดตัวอย่าง PDF…</p>
    </div>
  ),
})

export default async function PdfPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) redirect('/records')
  if (
    (session.user as any)?.role === 'hospital_user' &&
    (session.user as any)?.hospitalUnit &&
    String((record as any).unitName || '') !== String((session.user as any).hospitalUnit)
  ) {
    redirect('/records')
  }

  const data = JSON.parse(JSON.stringify(record))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/records/${params.id}`} className="text-gray-400 hover:text-gray-600">
            ← กลับ
          </Link>
          <h1 className="text-xl font-bold text-military-900">ตัวอย่าง PDF</h1>
        </div>
      </div>
      <PdfViewer record={data} recordId={params.id} />
    </div>
  )
}
