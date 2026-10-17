import {assertRecordOrderIdentity,OrderError} from '@/lib/workOrderValidation'
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
import { generateNextCertNo } from '@/lib/certNo'
import { shouldAssignCertificateNumber, stripClientNumberFields } from '@/lib/recordLifecycle'
import { resolveHospitalScope, scopeAllows } from '@/lib/hospitalScope'
import { assertRecordStandardsInOrder, releaseOrderDeviceIfUnused } from '@/lib/workOrderService'
import { environmentApprovalError } from '@/lib/environmentCheckServer'
import { canEditRecord, OWNERSHIP_ERROR } from '@/lib/recordOwnership'
import { verifyApprovalPin } from '@/lib/approvalPin'
import { logActivity } from '@/lib/activityLog'

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
  await connectDB()
  const record = await CalibrationRecord.findById(params.id).lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const scope = await resolveHospitalScope(session.user)
  if (!scopeAllows(scope, (record as any).unitName)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ record })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role

  await connectDB()
  const body = await req.json()
  const { saveAction, approve: _a0, ...rawBody } = body as {
    saveAction?: string
    approve?: string
    [k: string]: any
  }
  void _a0

  // แก้ไข record ได้เฉพาะผู้ดูแลระบบและเจ้าหน้าที่สอบเทียบ (ผู้อนุมัติใช้ช่องทางอนุมัติ/ตีกลับ)
  if (role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await CalibrationRecord.findById(params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // TOR 1.2.1.15: เจ้าหน้าที่แก้ไขได้เฉพาะรายการของตนเอง (ผู้สร้าง หรือผู้สอบเทียบ) ผู้ดูแลระบบไม่จำกัด
  if (!canEditRecord(session.user as any, existing)) {
    return NextResponse.json({ error: OWNERSHIP_ERROR }, { status: 403 })
  }
  // ใบรับรองที่อนุมัติแล้ว ล็อกไว้ ให้ผู้ดูแลระบบเท่านั้นที่แก้ (จะกลับเป็นร่างและต้องขออนุมัติใหม่)
  if (existing.approvalStatus === 'approved' && role !== 'admin') {
    return NextResponse.json(
      { error: 'ใบรับรองนี้อนุมัติแล้ว แก้ไขได้เฉพาะผู้ดูแลระบบ' },
      { status: 409 }
    )
  }

  assertRecordOrderIdentity(existing, rawBody)
  delete rawBody.workOrderNo
  // เครื่องมือมาตรฐานที่ใช้ต้องอยู่ในรายการของคำสั่ง (ตรวจจากค่าที่จะบันทึกจริง = ค่าเดิมทับด้วยค่าใหม่)
  if (existing.workOrderId) {
    const merged: Record<string, any> = { std1: existing.std1 }
    for (const slot of ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT']) merged[slot] = (existing as any)[slot]
    for (const key of Object.keys(merged)) if (key in rawBody) merged[key] = rawBody[key]
    await assertRecordStandardsInOrder(existing.workOrderId, merged)
  }
  const action = (saveAction === 'request_approval' ? 'request_approval' : 'draft') as
    | 'draft'
    | 'request_approval'
  if (action === 'request_approval' && role !== 'admin' && role !== 'technician') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sessionId = (session.user as any).id as string | undefined
  // TOR 1.2.1.14: ส่งขออนุมัติต้องยืนยันด้วย PIN ส่วนตัวของผู้ใช้ใน session (admin ก็ต้องใส่) และห้ามเก็บ PIN ลง record
  const approvalPin = rawBody.approvalPin
  delete rawBody.approvalPin
  if (action === 'request_approval') {
    const pinCheck = await verifyApprovalPin(sessionId, approvalPin)
    if (!pinCheck.ok) return NextResponse.json({ error: pinCheck.error }, { status: pinCheck.status })
  }
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

  const patch: Record<string, any> = stripClientNumberFields(rawBody)
  delete (patch as any).approve
  delete (patch as any).approvalPin

  if (action === 'request_approval') {
    if (!approverId) {
      return NextResponse.json(
        { error: 'กรุณาเลือกผู้อนุมัติก่อนส่งขออนุมัติใบเซอร์' },
        { status: 400 }
      )
    }
    // สภาวะแวดล้อมต้องอยู่ในเกณฑ์ก่อนส่งขออนุมัติ (TOR 1.2.2.3) — ตรวจจากค่าที่จะบันทึกจริง
    const envError = await environmentApprovalError({ ...existing.toObject(), ...rawBody })
    if (envError) return NextResponse.json({ error: envError }, { status: 409 })
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
  const needsCertNo = shouldAssignCertificateNumber(action, existing.certNo)
  const certNoDate = rawBody?.issuedDate || rawBody?.calDate || existing.issuedDate || existing.calDate
  if (needsCertNo && !String(existing.amedCertKey || '').trim()) {
    const nextKey = await generateNextAmedCertKey(rawBody?.amedNo ?? existing.amedNo)
    if (nextKey) patch.amedCertKey = nextKey
  }

  delete (patch as any).saveAction
  patch.savedOnce = true

  // ออกเลขใบรับรองแล้วบันทึก ถ้าเลขชนกับคนอื่น (unique index) ให้ออกเลขใหม่แล้วลองอีกครั้ง
  let record: any = null
  const maxAttempts = needsCertNo ? 5 : 1
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (needsCertNo) patch.certNo = await generateNextCertNo(certNoDate)
    try {
      record = await CalibrationRecord.findOneAndUpdate(
        { _id: params.id, updatedAt: existing.updatedAt },
        { $set: patch, $inc: { certificateRevision: 1 } },
        { new: true }
      )
      break
    } catch (e: any) {
      const duplicateCertNo = e?.code === 11000 && e?.keyPattern?.certNo
      if (!duplicateCertNo || attempt === maxAttempts - 1) throw e
    }
  }
  if (!record) return NextResponse.json({ error: 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่' }, { status: 409 })

  if (String(record.amedNo || '').trim() && String(record.certNo || '').trim()) {
    await registerAmedCertForRecord(record.amedNo, record.certNo, String(record._id))
  }
  await logActivity(req, session.user as any, action === 'request_approval' ? 'record_request_approval' : 'record_update', {
    targetType: 'record',
    targetId: record._id,
    detail: [record.certNo, record.amedNo, record.deviceName].filter(Boolean).join(' · ') || undefined,
  })
  return NextResponse.json({ record })
  } catch (err: any) {
    if (err instanceof OrderError) return NextResponse.json({error:err.message},{status:err.status})
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

  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  await connectDB()
  const removed: any = await CalibrationRecord.findByIdAndDelete(params.id).lean()
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // คืนสถานะเครื่องมือในคำสั่ง ถ้าไม่มี record อื่นใช้เครื่องมือนี้แล้ว
  if (removed.workOrderId && removed.workOrderDeviceId) {
    await releaseOrderDeviceIfUnused(removed.workOrderId, removed.workOrderDeviceId).catch(() => false)
  }
  await logActivity(req, session.user as any, 'record_delete', {
    targetType: 'record',
    targetId: params.id,
    detail: [removed.certNo, removed.amedNo, removed.deviceName].filter(Boolean).join(' · ') || undefined,
  })
  return NextResponse.json({ success: true })
}
