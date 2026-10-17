import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import StandardInstrumentYear from '@/models/StandardInstrumentYear'
import { getRecalibrationSettings } from '@/lib/recalibration'
import { evaluateStandardAgainstCriteria, standardDueDate, standardDueStatus } from '@/lib/standardCriteria'

export type StandardAlertItem = {
  _id: string
  no: string
  name: string
  nextCalDate: string | null
  reason: 'overdue' | 'expiringSoon' | 'failingCriteria'
  detail?: string
}

/**
 * แจ้งเตือนเครื่องมือมาตรฐาน (TOR 1.1.1.8, 1.4.4.1)
 * - ครบกำหนด = nextCalDate ของทะเบียน หรือวันหมดอายุ PDF ของปีล่าสุด
 * - ใกล้ครบกำหนดภายใน alertBeforeDays (ตั้งค่าเดียวกับใบรับรอง) / เกินกำหนด
 * - ไม่ผ่านเกณฑ์การยอมรับ (เทียบรุ่นข้อมูลล่าสุดกับ acceptanceCriteria)
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as { role?: string })?.role
  if (role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await connectDB()
  const { alertBeforeDays } = await getRecalibrationSettings()
  const roots = await mongoose.connection.db!.collection('stdinstrumentrefs')
    .find({}, { projection: { pdfData: 0 } })
    .toArray() as any[]
  const versions = await StandardInstrumentYear.find({ instrumentRefId: { $in: roots.map(r => String(r._id)) } })
    .sort({ year: -1, revision: -1 })
    .select('instrumentRefId year revision fields calPoints pdf')
    .lean() as any[]
  const latest = new Map<string, any>()
  for (const v of versions) if (!latest.has(v.instrumentRefId)) latest.set(v.instrumentRefId, v)

  const items: StandardAlertItem[] = []
  let expiringSoon = 0, overdue = 0, failingCriteria = 0
  const now = new Date()
  for (const root of roots) {
    const version = latest.get(String(root._id))
    const no = String(version?.fields?.no ?? root.no ?? '')
    const name = String(version?.fields?.name ?? root.name ?? '')
    const dueDate = standardDueDate(root, version)
    const status = standardDueStatus(dueDate, alertBeforeDays, now)
    if (status === 'overdue') {
      overdue++
      items.push({ _id: String(root._id), no, name, nextCalDate: dueDate, reason: 'overdue' })
    } else if (status === 'expiringSoon') {
      expiringSoon++
      items.push({ _id: String(root._id), no, name, nextCalDate: dueDate, reason: 'expiringSoon' })
    }
    const result = evaluateStandardAgainstCriteria(version || (root.calDate || root.correction != null ? { fields: root, calPoints: [] } : null), root.acceptanceCriteria)
    if (!result.pass) {
      failingCriteria++
      items.push({ _id: String(root._id), no, name, nextCalDate: dueDate, reason: 'failingCriteria', detail: result.failures.join('; ') })
    }
  }

  return NextResponse.json({
    count: expiringSoon + overdue + failingCriteria,
    expiringSoon,
    overdue,
    failingCriteria,
    alertBeforeDays,
    items,
  })
}
