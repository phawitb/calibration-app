import AdminUsers from '@/components/AdminUsers'
import ReferenceDataManager from '@/components/ReferenceDataManager'
import AdminCertNumberConfig from '@/components/AdminCertNumberConfig'
import AdminFormulaManager from '@/components/AdminFormulaManager'
import AdminIsoMethods from '@/components/AdminIsoMethods'

export default function AdminPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const tab = searchParams?.tab || 'users'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-military-900">จัดการระบบ</h1>
      {tab === 'users' && <AdminUsers />}
      {tab === 'data' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            เลือกหมวดด้านล่างเพื่อเพิ่ม แก้ไข หรือลบรายการในฐานข้อมูล (ใช้ร่วมกับฟอร์มสอบเทียบและคำแนะนำ)
          </p>
          <ReferenceDataManager />
        </div>
      )}
      {tab === 'cert' && <AdminCertNumberConfig />}
      {tab === 'formulas' && <AdminFormulaManager />}
      {tab === 'iso-methods' && <AdminIsoMethods />}
    </div>
  )
}
