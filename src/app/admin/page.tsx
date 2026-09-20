import AdminCertificateTexts from '@/components/AdminCertificateTexts'
import AdminUsers from '@/components/AdminUsers'
import ReferenceDataManager from '@/components/ReferenceDataManager'
import AdminCertNumberConfig from '@/components/AdminCertNumberConfig'
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
  if (searchParams?.tab === 'formulas') redirect('/admin?tab=data&category=stdinstruments')
  const tab = searchParams?.tab || (role === 'technician' ? 'data' : 'users')
  if (role === 'technician' && tab === 'users') redirect('/admin?tab=data')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-military-900">จัดการระบบ</h1>
      {tab === 'users' && <AdminUsers />}
      {tab === 'data' && <ReferenceDataManager initialCategory={searchParams?.category} />}
      {tab === 'certificate-texts' && <AdminCertificateTexts />}
      {tab === 'cert' && <AdminCertNumberConfig />}
      {tab === 'iso-methods' && <AdminIsoMethods />}
    </div>
  )
}
