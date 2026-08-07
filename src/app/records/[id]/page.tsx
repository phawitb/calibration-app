import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CalibrationForm from '@/components/CalibrationForm'
import RecordDetailTabs from '@/components/RecordDetailTabs'
import RecordCalculationPanel from '@/components/RecordCalculationPanel'
import RecordAmedHistoryPanel from '@/components/RecordAmedHistoryPanel'

export default async function RecordDetailPage({ params }: { params: { id: string } }) {
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

  // Convert dates to ISO strings for form
  const data = JSON.parse(JSON.stringify(record))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/records" className="text-gray-400 hover:text-gray-600 transition-colors">
            ← ข้อมูลสอบเทียบ
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-bold text-military-900">
            {(record as any).deviceName || 'รายละเอียด'}
          </h1>
        </div>
        <Link href={`/records/${params.id}/pdf`}
          className="btn-secondary flex items-center gap-2 text-sm">
          📄 Export PDF
        </Link>
      </div>

      {/* Quick info banner */}
      <div className="bg-military-800 text-white rounded-xl px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-military-300 text-xs">เลขที่อาร์เมด</p>
          <p className="font-semibold">{(record as any).amedNo || '-'}</p>
        </div>
        <div>
          <p className="text-military-300 text-xs">คีย์รายการ</p>
          <p className="font-semibold">{(record as any).amedCertKey || '-'}</p>
        </div>
        <div>
          <p className="text-military-300 text-xs">เลขที่ใบรับรอง</p>
          <p className="font-semibold">{(record as any).certNo || '-'}</p>
        </div>
        <div>
          <p className="text-military-300 text-xs">วันที่สอบเทียบ</p>
          <p className="font-semibold">
            {(record as any).calDate
              ? new Date((record as any).calDate).toLocaleDateString('th-TH')
              : '-'}
          </p>
        </div>
        <div>
          <p className="text-military-300 text-xs">แผนก</p>
          <p className="font-semibold">{(record as any).section || '-'}</p>
        </div>
      </div>

      <RecordDetailTabs
        calcPanel={<RecordCalculationPanel recordId={params.id} />}
        historyPanel={
          <RecordAmedHistoryPanel
            amedNo={String((record as any).amedNo || '')}
            currentRecordId={params.id}
            currentCertNo={String((record as any).certNo || '')}
          />
        }
      >
        <CalibrationForm mode="edit" id={params.id} initialData={data} />
      </RecordDetailTabs>
    </div>
  )
}
