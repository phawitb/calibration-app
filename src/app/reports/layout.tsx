import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role
  if (role === 'hospital_user') redirect('/dashboard')
  return (
    <AppShell contentClassName="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 print:max-w-none print:px-0 print:py-0">
      {children}
    </AppShell>
  )
}
