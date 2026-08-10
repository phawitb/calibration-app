import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import AdminSubnav from '@/components/AdminSubnav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'admin' && role !== 'technician')) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-military-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminSubnav canManageUsers={role === 'admin'} />
        {children}
      </main>
    </div>
  )
}
