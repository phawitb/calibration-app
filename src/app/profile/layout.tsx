import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppShell from '@/components/AppShell'

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return <AppShell contentClassName="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</AppShell>
}
