import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import CalibrationRecord from '@/models/CalibrationRecord'
import mongoose from 'mongoose'
import { formatHospitalUnitLabel } from '@/lib/hospitalUnit'
import { registerAmedCertForRecord } from '@/lib/amedCertHistory'
import User from '@/models/User'
import { generateNextAmedCertKey } from '@/lib/amedKey'
import { shouldSessionOwnCalibration } from '@/lib/recordPersonnel'

async function getUnitVariants(inputRaw: unknown) {
  const input = String(inputRaw || '').trim()
  if (!input) return []
  const db = mongoose.connection.db
  if (!db) return [input]
  const rows = await db.collection('unitnames')
    .find({}, { projection: { name: 1, thaiName: 1 } })
    .limit(5000)
    .toArray()
  const norm = input.toLowerCase()
  for (const row of rows) {
    const en = String((row as any)?.name || '').trim()
    const th = String((row as any)?.thaiName || '').trim()
    const label = formatHospitalUnitLabel(en, th)
    const keys = [en, th, label].map((v) => v.toLowerCase()).filter(Boolean)
    if (keys.includes(norm)) return Array.from(new Set([label, en, th].filter(Boolean)))
  }
  return [input]
}

async function normalizeHospitalUnit(inputRaw: unknown) {
  const variants = await getUnitVariants(inputRaw)
  return variants[0] || ''
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'hospital_user' && hospitalUnit) {
    const unitVariants = await getUnitVariants(hospitalUnit)
    if (!unitVariants.includes(String((record as any).unitName || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({ record })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  await connectDB()
  const body = await req.json()
  const { saveAction, approve: _a0, ...rawBody } = body as {
    saveAction?: string
    approve?: string
    [k: string]: any
  }
  void _a0

  const existing = await CalibrationRecord.findById(params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (role === 'hospital_user' && hospitalUnit) {
    const unitVariants = await getUnitVariants(hospitalUnit)
    if (!unitVariants.includes(String(existing.unitName || ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(
      { error: 'Hospital user can view only' },
      { status: 403 }
    )
  }

  const action = (saveAction === 'request_approval' ? 'request_approval' : 'draft') as
    | 'draft'
    | 'request_approval'
  if (action === 'request_approval' && role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessionId = (session.user as any).id as string | undefined
  const approverId = rawBody?.requestedApproverId != null && String(rawBody.requestedApproverId)
    ? String(rawBody.requestedApproverId)
    : ''
  const selectedApprover = approverId
    ? await User.findById(approverId).select('name fullName fullNameEn').lean()
    : null
  const approverName = selectedApprover
    ? String(
        (selectedApprover as any).fullNameEn || (selectedApprover as any).fullName || (selectedApprover as any).name || ''
      ).trim()
    : String(rawBody?.requestedApproverName || '')

  const normalizedUnitName = rawBody?.unitName != null ? await normalizeHospitalUnit(rawBody.unitName) : undefined
  const normalizedLocation = rawBody?.location != null ? await normalizeHospitalUnit(rawBody.location) : undefined

  const patch: Record<string, any> = { ...rawBody }
  delete (patch as any).approve

  if (action === 'request_approval') {
    if (!approverId) {
      return NextResponse.json(
        { error: 'กรุณาเลือกผู้อนุมัติก่อนส่งขออนุมัติใบเซอร์' },
        { status: 400 }
      )
    }
    patch.approvalStatus = 'pending_approval'
    patch.requestedApproverId = approverId
    patch.requestedApproverName = approverName
    patch.approvedById = undefined
    patch.approvedByName = undefined
    patch.approvedAt = undefined
    patch.approve = ''
    patch.rejectionComment = undefined
    patch.rejectedById = undefined
    patch.rejectedByName = undefined
    patch.rejectedAt = undefined
  } else {
    patch.approvalStatus = 'draft'
    if (existing.approvalStatus === 'approved' || existing.approvalStatus === 'pending_approval' || existing.approvalStatus === 'rejected') {
      patch.approvedById = undefined
      patch.approvedByName = undefined
      patch.approvedAt = undefined
      patch.approve = ''
      patch.rejectionComment = undefined
      patch.rejectedById = undefined
      patch.rejectedByName = undefined
      patch.rejectedAt = undefined
    }
    if (approverId) {
      patch.requestedApproverId = approverId
      patch.requestedApproverName = approverName
    } else {
      patch.requestedApproverId = undefined
      patch.requestedApproverName = undefined
    }
  }

  if (sessionId && shouldSessionOwnCalibration(role)) {
    patch.calibratedById = sessionId
    const me = await User.findById(sessionId).select('name fullName fullNameEn').lean()
    patch.calibrate = String(
      (me as any)?.fullNameEn || (me as any)?.fullName || (me as any)?.name || patch.calibrate || ''
    ).trim()
  } else {
    delete patch.calibratedById
    delete patch.calibrate
  }

  if (normalizedUnitName !== undefined) patch.unitName = normalizedUnitName || ''
  if (normalizedLocation !== undefined) patch.location = normalizedLocation || ''
  if (!String(existing.amedCertKey || '').trim()) {
    const nextKey = await generateNextAmedCertKey(rawBody?.amedNo ?? existing.amedNo)
    if (nextKey) patch.amedCertKey = nextKey
  }

  delete (patch as any).saveAction
  patch.savedOnce = true
  const record = await CalibrationRecord.findByIdAndUpdate(
    params.id,
    { $set: patch },
    { new: true }
  )
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (String(record.amedNo || '').trim() && String(record.certNo || '').trim()) {
    await registerAmedCertForRecord(record.amedNo, record.certNo, String(record._id))
  }
  return NextResponse.json({ record })
  } catch (err: any) {
    console.error('PUT /api/records/[id] error:', err)
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await connectDB()
  await CalibrationRecord.findByIdAndDelete(params.id)
  return NextResponse.json({ success: true })
}
