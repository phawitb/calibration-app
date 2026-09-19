import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import AppShell from '@/components/AppShell'
export default async function OrdersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getServerSession(authOptions))) redirect('/login')
  return <AppShell>{children}</AppShell>
}
