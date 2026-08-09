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
import { generateNextCertNo } from '@/lib/certNo'
import { calcRecalibrationDates, getRecalibrationSettings } from '@/lib/recalibration'

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const { searchParams } = new URL(req.url)
  const search  = (searchParams.get('search') || '').trim()
  const page    = parseInt(searchParams.get('page') || '1')
  const limit   = parseInt(searchParams.get('limit') || '20')
  const section = searchParams.get('section') || ''
  const cardFilter = String(searchParams.get('cardFilter') || '').trim()
  const calType = searchParams.get('calType') || ''
  const status = searchParams.get('status') || ''
  const unitName = searchParams.get('unitName') || ''
  const calDateFrom = searchParams.get('calDateFrom') || ''
  const calDateTo = searchParams.get('calDateTo') || ''
  const role = (session.user as any)?.role
  const hospitalUnit = (session.user as any)?.hospitalUnit

  const query: any = {
    // ซ่อน record ที่ยังไม่เคยกดบันทึก
    savedOnce: { $ne: false },
  }
  if (role === 'hospital_user' && hospitalUnit) {
    const unitVariants = await getUnitVariants(hospitalUnit)
    query.unitName = { $in: unitVariants }
  }
  if (search) {
    // Some imported fields can be stored as numbers; regex on string fields alone misses them.
    const numericToStringSearch = {
      $expr: {
        $regexMatch: {
          input: { $toString: { $ifNull: ['$amedNo', ''] } },
          regex: search,
          options: 'i',
        },
      },
    }

    query.$or = [
      {
        $expr: {
          $eq: [{ $toString: { $ifNull: ['$amedNo', ''] } }, search],
        },
      },
      { amedNo:     { $regex: search, $options: 'i' } },
      { certNo:     { $regex: search, $options: 'i' } },
      { deviceName: { $regex: search, $options: 'i' } },
      { unitName:   { $regex: search, $options: 'i' } },
      { serialNo:   { $regex: search, $options: 'i' } },
      numericToStringSearch,
    ]
  }
  if (section) query.section = { $regex: section, $options: 'i' }
  if (calType) query.calibrationType = calType
  if (status) query.approvalStatus = status
  if (unitName && !query.unitName) query.unitName = { $regex: unitName, $options: 'i' }
  if (calDateFrom || calDateTo) {
    query.calDate = query.calDate || {}
    if (calDateFrom) query.calDate.$gte = new Date(calDateFrom)
    if (calDateTo) query.calDate.$lte = new Date(calDateTo + 'T23:59:59.999Z')
  }
  if (cardFilter) {
    const now = new Date()
    switch (cardFilter) {
      case 'pending':
        query.approvalStatus = 'pending_approval'
        break
      case 'approved':
        query.approvalStatus = 'approved'
        break
      case 'draft':
        query.approvalStatus = 'draft'
        break
      case 'week': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
        query.createdAt = { $gte: start }
        break
      }
      case 'today': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        query.createdAt = { $gte: start }
        break
      }
      case 'expiring':
      case 'overdue': {
        const { certValidityMonths, alertBeforeDays } = await getRecalibrationSettings()
        const { dueBoundary, expiringStart, expiringEnd } = calcRecalibrationDates(
          now,
          certValidityMonths,
          alertBeforeDays
        )
        query.approvalStatus = 'approved'
        query.calDate =
          cardFilter === 'expiring'
            ? { $gte: expiringStart, $lte: expiringEnd }
            : { $lte: dueBoundary }
        break
      }
      default:
        break
    }
  }

  const effectiveLimit = search ? Math.max(limit, 200) : limit
  const total   = await CalibrationRecord.countDocuments(query)
  const records = await CalibrationRecord.find(query)
    .select('recordNo sbNo amedNo certNo deviceName brand model serialNo unitName section calDate select lapTemp lapHumid calibrate approve calPrice approvalStatus requestedApproverName calibrationType isoMethodCode updatedAt')
    .sort({ calDate: -1, recordNo: -1 })
    .skip((page - 1) * effectiveLimit)
    .limit(effectiveLimit)
    .lean()

  return NextResponse.json({ records, total, page, totalPages: Math.ceil(total / effectiveLimit) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await connectDB()

  const body = await req.json()
  const { saveAction, approve: _apClient, ...rawBody } = body as {
    saveAction?: string
    approve?: string
    [k: string]: any
  }
  const action = (saveAction === 'request_approval' ? 'request_approval' : 'draft') as
    | 'draft'
    | 'request_approval'
  const role = (session.user as any).role as string
  const sessionId = (session.user as any).id as string | undefined

  const normalizedUnitName = await normalizeHospitalUnit(rawBody?.unitName)
  const normalizedLocation = rawBody?.location ? await normalizeHospitalUnit(rawBody.location) : ''
  const approverId = rawBody?.requestedApproverId ? String(rawBody.requestedApproverId) : ''
  const selectedApprover = approverId
    ? await User.findById(approverId).select('name fullName rank fullNameEn rankEn').lean()
    : null
  const approverName = selectedApprover
    ? String(
        `${(selectedApprover as any).rankEn || (selectedApprover as any).rank || ''} ${(selectedApprover as any).fullNameEn || (selectedApprover as any).fullName || (selectedApprover as any).name || ''}`.trim()
      )
    : String(rawBody?.requestedApproverName || '')

  const me = await User.findById((session.user as any).id).select('name fullName rank fullNameEn rankEn').lean()
  const calibratedName = String(
    `${(me as any)?.rankEn || (me as any)?.rank || ''} ${(me as any)?.fullNameEn || (me as any)?.fullName || (me as any)?.name || rawBody?.calibrate || ''}`.trim()
  )

  let approvalStatus: 'draft' | 'pending_approval' = 'draft'
  if (action === 'request_approval') {
    if (!approverId) {
      return NextResponse.json(
        { error: 'กรุณาเลือกผู้อนุมัติก่อนส่งขออนุมัติใบเซอร์' },
        { status: 400 }
      )
    }
    if (role !== 'admin' && role !== 'technician') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    approvalStatus = 'pending_approval'
  }

  const technicianId = role === 'technician' && sessionId ? sessionId : rawBody?.calibratedById || undefined
  const amedCertKey =
    String(rawBody?.amedCertKey || '').trim() ||
    await generateNextAmedCertKey(rawBody?.amedNo)
  const certNo =
    String(rawBody?.certNo || '').trim() ||
    await generateNextCertNo(rawBody?.issuedDate || rawBody?.calDate)

  const record = new CalibrationRecord({
    ...rawBody,
    certNo,
    unitName: normalizedUnitName || rawBody?.unitName || '',
    location: normalizedLocation || rawBody?.location || '',
    requestedApproverId: approverId || undefined,
    requestedApproverName: approverName || undefined,
    approvalStatus,
    approve: '',
    calibratedById: technicianId,
    amedCertKey: amedCertKey || undefined,
    calibrate: calibratedName || rawBody?.calibrate || '',
    createdBy: (session.user as any).username,
  })
  if (action === 'draft' && !approverId) {
    record.requestedApproverId = undefined
    record.requestedApproverName = undefined
  }

  await record.save()
  if (String(record.amedNo || '').trim() && String(record.certNo || '').trim()) {
    await registerAmedCertForRecord(record.amedNo, record.certNo, String(record._id))
  }
  return NextResponse.json({ record }, { status: 201 })
}
