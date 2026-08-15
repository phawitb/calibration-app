import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session) redirect('/login')
  if (role !== 'admin' && role !== 'approver') redirect('/dashboard')

  return <AppShell>{children}</AppShell>
}
