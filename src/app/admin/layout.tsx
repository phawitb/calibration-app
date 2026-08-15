import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'
import AdminSubnav from '@/components/AdminSubnav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'technician')) redirect('/dashboard')
  return (
    <AppShell>
      <AdminSubnav canManageUsers={role === 'admin'} />
      {children}
    </AppShell>
  )
}
