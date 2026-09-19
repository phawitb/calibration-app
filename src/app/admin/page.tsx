import AdminUsers from '@/components/AdminUsers'
import ReferenceDataManager from '@/components/ReferenceDataManager'
import AdminCertNumberConfig from '@/components/AdminCertNumberConfig'
import AdminFormulaManager from '@/components/AdminFormulaManager'
import AdminIsoMethods from '@/components/AdminIsoMethods'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { tab?: string; category?: string }
}) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (searchParams?.tab === 'orders') redirect('/admin?tab=data&category=orders')
  const tab = searchParams?.tab || (role === 'technician' ? 'data' : 'users')
  if (role === 'technician' && tab === 'users') redirect('/admin?tab=data')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-military-900">จัดการระบบ</h1>
      {tab === 'users' && <AdminUsers />}
      {tab === 'data' && <ReferenceDataManager initialCategory={searchParams?.category} />}
      {tab === 'cert' && <AdminCertNumberConfig />}
      {tab === 'formulas' && <AdminFormulaManager />}
      {tab === 'iso-methods' && <AdminIsoMethods />}
    </div>
  )
}
