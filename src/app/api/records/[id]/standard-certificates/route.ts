import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import { getUnitVariants } from '@/lib/unitVariants'
import { STANDARD_SLOTS } from '@/lib/standardYears'
import { pdfBytes } from '@/lib/pdfBytes'
import { inlineContentDisposition } from '@/lib/contentDisposition'
import CalibrationRecord from '@/models/CalibrationRecord'
import StandardInstrumentYear from '@/models/StandardInstrumentYear'
import StdInstrumentCert from '@/models/StdInstrumentCert'

async function certificateFor(std: any, includePdf: boolean) {
  if (std.referenceVersionId) {
    if (!mongoose.isValidObjectId(std.referenceVersionId)) return null
    return StandardInstrumentYear.findOne({ _id: std.referenceVersionId, instrumentRefId: std.instrumentRefId, year: std.referenceYear })
      .select(includePdf ? '+pdfData' : '-pdfData').lean()
  }
  // Unversioned records must match a specific certificate, never the latest year.
  if (!std.no || !std.certNo) return null
  const roots = await mongoose.connection.db!.collection('stdinstrumentrefs').find({ no: { $in: [std.no, String(std.no)] } }, { projection: { _id: 1, serialNo: 1 } }).toArray()
  const ids = roots.filter(root => !std.serialNo || String(root.serialNo) === String(std.serialNo)).map(root => String(root._id))
  const legacy = await StdInstrumentCert.find({ instrumentRefId: { $in: ids }, certNo: std.certNo }).select(includePdf ? '' : '-pdfData').limit(2).lean()
  if (legacy.length === 1) return legacy[0]
  if (legacy.length > 1) return null
  const versions = await StandardInstrumentYear.find({ instrumentRefId: { $in: ids }, 'fields.certNo': std.certNo, 'pdf.fileName': { $exists: true } }).select(includePdf ? '+pdfData' : '-pdfData').limit(2).lean()
  return versions.length === 1 ? versions[0] : null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await connectDB()
  const record: any = await CalibrationRecord.findById(params.id).select('unitName std1 uc1.std uc2.std uc3.std uc4.std uc5.std uc6.std ucT.std').lean()
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const user = session.user as any
  if (user.role === 'hospital_user' && (!user.hospitalUnit || !(await getUnitVariants(user.hospitalUnit)).includes(record.unitName))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const slot = req.nextUrl.searchParams.get('slot')
  if (slot) {
    if (!(STANDARD_SLOTS as readonly string[]).includes(slot)) return NextResponse.json({ error: 'Invalid slot' }, { status: 400 })
    const std = slot === 'std1' ? record.std1 : record[slot]?.std
    const cert: any = std ? await certificateFor(std, true) : null
    if (!cert?.pdfData) return NextResponse.json({ error: 'ไม่พบ PDF ที่ตรงกับมาตรฐานที่ใช้' }, { status: 404 })
    return new NextResponse(new Uint8Array(pdfBytes(cert.pdfData)), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': inlineContentDisposition(cert.pdf?.fileName || cert.fileName || 'standard-certificate.pdf'), 'Cache-Control': 'private, no-store' } })
  }
  const data = await Promise.all(STANDARD_SLOTS.map(async slot => {
    const std = slot === 'std1' ? record.std1 : record[slot]?.std
    if (!std?.no && !std?.name) return null
    const cert: any = await certificateFor(std, false)
    return { documentKey: cert ? `${cert.pdf ? 'annual' : 'legacy'}:${cert._id}` : undefined, slot, no: std.no, name: std.name, certNo: std.certNo, year: std.referenceYear || cert?.year, hasPdf: !!(cert?.pdf?.fileName || cert?.fileName) }
  }))
  return NextResponse.json({ data: data.filter(Boolean) }, { headers: { 'Cache-Control': 'private, no-store' } })
}
