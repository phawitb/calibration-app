import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './auth'
import { connectDB } from './mongodb'
import { StandardYearError } from './standardYears'
export async function standardYearActor() {
  const session=await getServerSession(authOptions)
  if(!session || !['admin','technician'].includes((session.user as any)?.role)) throw new StandardYearError('Forbidden',403)
  await connectDB()
  return String((session.user as any).id)
}
export function standardYearFailure(error:unknown) {
  if(error instanceof StandardYearError) return NextResponse.json({error:error.message},{status:error.status})
  if(error instanceof SyntaxError) return NextResponse.json({error:'ข้อมูลไม่ถูกต้อง'},{status:400})
  console.error('Standard year operation failed',error)
  return NextResponse.json({error:'ไม่สามารถดำเนินการได้ กรุณาลองใหม่'},{status:500})
}
