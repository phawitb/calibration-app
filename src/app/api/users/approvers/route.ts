import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()
  const users = await User.find({
    role: { $in: ['approver', 'admin'] },
    isActive: { $ne: false },
  })
    .select('_id username name fullName rank fullNameEn rankEn role hospitalUnit')
    .sort({ fullNameEn: 1, fullName: 1, name: 1 })
    .lean()

  return NextResponse.json({ users })
}
