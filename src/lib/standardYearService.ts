import { pdfBytes } from './pdfBytes'
import mongoose from 'mongoose'
import { randomUUID } from 'crypto'
import StandardInstrumentYear from '../models/StandardInstrumentYear'
import StdCalPointConfig from '../models/StdCalPointConfig'
import StdInstrumentCert from '../models/StdInstrumentCert'
import { StandardYearError, normalizeStandardYear, normalizeStandardFields, latestStandardYears, standardSnapshot } from './standardYears'

export function standardId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new StandardYearError('รหัสรายการไม่ถูกต้อง')
  return new mongoose.Types.ObjectId(id)
}
export async function getStandardRoot(id: string) {
  const root = await mongoose.connection.db!.collection('stdinstrumentrefs').findOne({ _id: standardId(id) })
  if (!root) throw new StandardYearError('ไม่พบเครื่องมือมาตรฐาน',404)
  return root
}
export function publicStandardVersion(doc: any) {
  if (!doc) return null
  const { pdfData, __v, ...rest } = doc.toObject ? doc.toObject() : doc
  return JSON.parse(JSON.stringify(rest))
}
export async function listStandardYears(id: string) {
  const root = await getStandardRoot(id)
  const versions = await StandardInstrumentYear.find({ instrumentRefId: id }).sort({ year:-1, revision:-1 }).lean()
  const [calPoints,certificates] = await Promise.all([
    StdCalPointConfig.find({ instrumentRefId:id }).sort({ order:1, createdAt:1 }).lean(),
    StdInstrumentCert.find({ instrumentRefId:id }).select('-pdfData').sort({ year:-1 }).lean(),
  ])
  return { data: latestStandardYears(versions as any).map(publicStandardVersion), legacy: { fields: root, calPoints, certificates } }
}
function normalizeTables(input: any) {
  if (!Array.isArray(input) || input.length > 100) throw new StandardYearError('ตารางจุดสอบเทียบไม่ถูกต้อง')
  const ids = new Set<string>()
  return input.map((table,index) => {
    const id = String(table._id || randomUUID())
    if (ids.has(id)) throw new StandardYearError('รหัสตารางซ้ำ')
    ids.add(id)
    if (!Array.isArray(table.points) || !table.points.length || table.points.length > 1000) throw new StandardYearError('กรุณาระบุจุดสอบเทียบ')
    const points = table.points.map((p:any) => {
      if (p.pointValue === '' || p.pointValue == null || !['string','number'].includes(typeof p.pointValue)) throw new StandardYearError('ค่าจุดสอบเทียบไม่ถูกต้อง')
      return { pointValue:p.pointValue, unit:String(p.unit || '') }
    })
    const values = table.stdValues ?? []
    if (!Array.isArray(values) || values.length > points.length || values.some((v:any) => v != null && !['string','number'].includes(typeof v))) throw new StandardYearError('ค่า STD ไม่ถูกต้อง')
    return { _id:id, tableName:String(table.tableName || `table${index+1}`), points, stdValues:values, order:index }
  })
}
async function appendVersion(id: string, year: number, expectedRevision: number, document: any) {
  let result: any
  await mongoose.connection.transaction(async session => {
    // Saves, PDF uploads and retrospective updates serialize on the same instrument head.
    const root = await mongoose.connection.db!.collection('stdinstrumentrefs').findOneAndUpdate(
      { _id: standardId(id) }, { $inc: { standardYearEpoch: 1 } }, { session })
    if (!root) throw new StandardYearError('ไม่พบเครื่องมือมาตรฐาน',404)
    const current = await StandardInstrumentYear.findOne({ instrumentRefId:id, year }).sort({revision:-1}).session(session).lean() as any
    if ((current?.revision || 0) !== expectedRevision) throw new StandardYearError('ข้อมูลปีนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409)
    const created = await StandardInstrumentYear.create([document], { session })
    result = publicStandardVersion(created[0])
  })
  return result
}
export async function saveStandardYear(id: string, input: any, actorId: string, file?: File) {
  await getStandardRoot(id)
  const year = normalizeStandardYear(input.year)
  const previous = await StandardInstrumentYear.findOne({ instrumentRefId:id, year }).sort({ revision:-1 }).select('+pdfData').lean() as any
  if (Number(input.expectedRevision) !== (previous?.revision || 0)) throw new StandardYearError('ข้อมูลปีนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409)
  const fields = normalizeStandardFields(input.fields)
  const calPoints = normalizeTables(input.calPoints || [])
  // Existing PDFs are linked only by their explicit year; they cannot supply missing field history.
  const oldPdf = !previous ? await StdInstrumentCert.findOne({ instrumentRefId:id, year:{$in:[year,year+543]} }).lean() as any : null
  let pdf = previous?.pdf || (oldPdf ? { fileName:oldPdf.fileName,certNo:oldPdf.certNo,expiryDate:oldPdf.expiryDate } : undefined)
  let attachment: Buffer | undefined
  if (file) {
    if (file.type !== 'application/pdf' || file.size > 8 * 1024 * 1024) throw new StandardYearError('ต้องเป็น PDF ขนาดไม่เกิน 8 MB')
    attachment = Buffer.from(await file.arrayBuffer())
    if (attachment.subarray(0, 5).toString() !== '%PDF-') throw new StandardYearError('ไฟล์ไม่ใช่ PDF')
    const expiryDate = input.pdfExpiryDate ? String(input.pdfExpiryDate) : undefined
    if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new StandardYearError('วันหมดอายุไม่ถูกต้อง')
    pdf = { fileName: file.name, certNo: String(fields.certNo || ''), expiryDate }
  }
  try {
    return await appendVersion(id, year, previous?.revision || 0, { instrumentRefId:id, year, revision:(previous?.revision||0)+1, fields, calPoints, pdf, pdfData:attachment ?? (previous?.pdfData ? pdfBytes(previous.pdfData) : oldPdf?.pdfData ? pdfBytes(oldPdf.pdfData) : undefined), changedBy:actorId })
  } catch (error:any) { if (error.code===11000) throw new StandardYearError('ข้อมูลปีนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409); throw error }
}
export async function uploadStandardYearPdf(id:string,yearInput:unknown,file:File,expectedRevision:unknown,actorId:string,metadata: {certNo?:unknown;expiryDate?:unknown} = {}) {
  const year=normalizeStandardYear(yearInput)
  const previous=await StandardInstrumentYear.findOne({instrumentRefId:id,year}).sort({revision:-1}).lean() as any
  if (!previous) throw new StandardYearError('บันทึกข้อมูลปีนี้ก่อนแนบ PDF',404)
  if(Number(expectedRevision)!==previous.revision) throw new StandardYearError('ข้อมูลปีนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409)
  if (!file || file.type!=='application/pdf' || file.size>8*1024*1024) throw new StandardYearError('ต้องเป็น PDF ขนาดไม่เกิน 8 MB')
  const expiryDate = metadata.expiryDate ? String(metadata.expiryDate) : undefined
  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new StandardYearError('วันหมดอายุไม่ถูกต้อง')
  const buffer=Buffer.from(await file.arrayBuffer())
  if(buffer.subarray(0,5).toString()!=='%PDF-') throw new StandardYearError('ไฟล์ไม่ใช่ PDF')
  try {
    return await appendVersion(id, year, previous.revision, {instrumentRefId:id,year,revision:previous.revision+1,fields:previous.fields,calPoints:previous.calPoints,pdf:{fileName:file.name,certNo:String(metadata.certNo || previous.fields.certNo || ''),expiryDate},pdfData:buffer,changedBy:actorId})
  } catch(error:any) { if(error.code===11000) throw new StandardYearError('ข้อมูลปีนี้เปลี่ยนแล้ว กรุณาโหลดใหม่',409); throw error }
}
export async function projectLatestStandards(roots:any[]) {
  const versions=await StandardInstrumentYear.find({instrumentRefId:{$in:roots.map(r=>String(r._id))}}).sort({year:-1,revision:-1}).lean() as any[]
  const latest=new Map<string,any>()
  for(const v of versions) if(!latest.has(v.instrumentRefId)) latest.set(v.instrumentRefId,v)
  return roots.map(root=> { const v=latest.get(String(root._id)); return v ? {...root,...standardSnapshot(v),_id:root._id} : root })
}
