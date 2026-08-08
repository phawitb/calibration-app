import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'

const ALLOWED_ROLES = ['admin', 'hospital_user', 'technician', 'approver'] as const

async function normalizeHospitalUnit(raw: unknown): Promise<string> {
  const input = String(raw || '').trim()
  if (!input) return ''
  const db = mongoose.connection.db
  if (!db) return input
  const rows = await db.collection('unitnames')
    .find({}, { projection: { name: 1, thaiName: 1 } })
    .limit(5000)
    .toArray()
  const norm = input.toLowerCase()
  for (const row of rows) {
    const en = String((row as any)?.name || '').trim()
    const th = String((row as any)?.thaiName || '').trim()
    const label = en && th ? `${en} (${th})` : en || th
    const keys = [en, th, label].map((v) => v.toLowerCase()).filter(Boolean)
    if (keys.includes(norm)) return label || input
  }
  return input
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const oneId = String(searchParams.get('id') || '').trim()
  if (oneId) {
    const u = await User.findById(oneId).select('-password').lean()
    if (!u) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ user: u })
  }

  const users = await User.find({}).select('-password -signaturePng').lean()
  const sigRows = await User.find({ signaturePng: { $exists: true, $nin: [null, ''] } })
    .select('_id')
    .lean()
  const sigSet = new Set((sigRows as { _id: unknown }[]).map((r) => String(r._id)))
  const withFlag = (users as any[]).map((u) => ({
    ...u,
    hasSignature: sigSet.has(String((u as any)._id)),
  }))
  return NextResponse.json({ users: withFlag })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const {
    username, password, name, role, rank, fullName, hospitalUnit, signaturePng, fullNameEn, rankEn, amedNo,
  } = await req.json()
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const existing = await User.findOne({ username })
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 400 })

  const normalizedHospitalUnit = await normalizeHospitalUnit(hospitalUnit)
  const hashed = await bcrypt.hash(password, 10)
  if (signaturePng != null && String(signaturePng).length > 1_200_000) {
    return NextResponse.json({ error: 'รูปลายเซ็นใหญ่เกินไป' }, { status: 400 })
  }
  if (signaturePng && !['technician', 'approver'].includes(role)) {
    return NextResponse.json({ error: 'ลายเซ็นใช้ได้เฉพาะจนท.สอบเทียบและผู้อนุมัติ' }, { status: 400 })
  }
  const user = new User({
    username,
    password: hashed,
    name,
    fullName: fullName || name,
    role,
    rank: rank || '',
    fullNameEn: fullNameEn ? String(fullNameEn).trim() : '',
    rankEn: rankEn ? String(rankEn).trim() : '',
    hospitalUnit: normalizedHospitalUnit,
    amedNo: amedNo ? String(amedNo).trim() : '',
    signaturePng: signaturePng ? String(signaturePng) : undefined,
    isActive: true,
  })
  await user.save()

  return NextResponse.json({
    user: {
      _id: user._id,
      username,
      name,
      fullName: user.fullName,
      rank: user.rank,
      fullNameEn: user.fullNameEn,
      rankEn: user.rankEn,
      hospitalUnit: user.hospitalUnit,
      amedNo: user.amedNo,
      role,
    },
  }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const body = await req.json()
  const id = String(body?._id || '')
  if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

  const update: Record<string, any> = {}
  if (body.username != null) update.username = String(body.username).trim()
  if (body.name != null) update.name = String(body.name).trim()
  if (body.fullName != null) update.fullName = String(body.fullName).trim()
  if (body.rank != null) update.rank = String(body.rank).trim()
  if (body.fullNameEn != null) update.fullNameEn = String(body.fullNameEn).trim()
  if (body.rankEn != null) update.rankEn = String(body.rankEn).trim()
  if (body.hospitalUnit != null) update.hospitalUnit = await normalizeHospitalUnit(body.hospitalUnit)
  if (body.amedNo != null) update.amedNo = String(body.amedNo).trim()
  if (body.role != null) {
    if (!ALLOWED_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    update.role = body.role
  }
  if (body.isActive != null) update.isActive = !!body.isActive
  if (body.resetPassword != null) {
    const nextPwd = String(body.resetPassword || '')
    if (nextPwd.length < 4) return NextResponse.json({ error: 'Password too short' }, { status: 400 })
    update.password = await bcrypt.hash(nextPwd, 10)
  }
  if (body.signaturePng !== undefined) {
    const u = await User.findById(id).lean()
    const effRole = body.role != null ? String(body.role) : (u as any)?.role
    if (body.signaturePng && !['technician', 'approver'].includes(effRole)) {
      return NextResponse.json(
        { error: 'ลายเซ็นใช้ได้เฉพาะจนท.สอบเทียบและผู้อนุมัติ' },
        { status: 400 }
      )
    }
    if (body.signaturePng === null) update.signaturePng = undefined
    else {
      const s = String(body.signaturePng)
      if (s.length > 1_200_000) {
        return NextResponse.json({ error: 'รูปลายเซ็นใหญ่เกินไป (ลองไฟล์ .png ที่เล็กกว่า)' }, { status: 400 })
      }
      update.signaturePng = s
    }
  }

  const user = await User.findByIdAndUpdate(id, update, { new: true }).select('-password').lean()
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ user })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  const { searchParams } = new URL(req.url)
  const id = String(searchParams.get('id') || '').trim()
  if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

  const currentUsername = String((session.user as any).username || '')
  const target = await User.findById(id).lean()
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (String((target as any).username || '') === currentUsername) {
    return NextResponse.json({ error: 'Cannot delete current login user' }, { status: 400 })
  }
  await User.findByIdAndDelete(id)
  return NextResponse.json({ success: true })
}

// Seed initial admin - call once via PUT (no auth; only when user count is 0)
export async function PUT(req: NextRequest) {
  await connectDB()
  const count = await User.countDocuments()
  if (count > 0) return NextResponse.json({ message: 'Already seeded' })

  const hashed = await bcrypt.hash('admin1234', 10)
  await User.create({
    username: 'admin',
    password: hashed,
    name: 'ผู้ดูแลระบบ',
    fullName: 'ผู้ดูแลระบบ',
    role: 'admin',
    isActive: true,
  })
  return NextResponse.json({ message: 'Admin created: admin / admin1234' })
}
