import { pdfBytes } from '@/lib/pdfBytes'
import mongoose from 'mongoose'
import StandardInstrumentYear from '../models/StandardInstrumentYear'
import CalibrationRecord from '../models/CalibrationRecord'
import ArchivedCertificatePdf from '../models/ArchivedCertificatePdf'
import CertificateRevision from '../models/CertificateRevision'
import { STANDARD_SLOTS, StandardYearError, normalizeStandardYear, planStandardUpdate } from './standardYears'
import { standardId } from './standardYearService'
import { renderCertificatePdf } from './renderCertificatePdf'

async function context(instrumentRefId:string,yearInput:unknown) {
  const year=normalizeStandardYear(yearInput)
  const versions=await StandardInstrumentYear.find({instrumentRefId}).sort({revision:-1}).lean() as any[]
  const target=versions.find(v=>v.year===year)
  if(!target) throw new StandardYearError('ไม่พบข้อมูลปีนี้',404)
  return {versions,target,year}
}
export async function previewStandardUpdates(instrumentRefId:string,yearInput:unknown) {
  const {versions,target,year}=await context(instrumentRefId,yearInput)
  const nos=Array.from(new Set(versions.map(v=>String(v.fields.no))))
  const query={$or:STANDARD_SLOTS.flatMap(slot=> {
    const path=slot==='std1'?'std1':`${slot}.std`
    return [{[`${path}.instrumentRefId`]:instrumentRefId},{[`${path}.no`]:{$in:nos}}]
  })}
  const records=await CalibrationRecord.find(query).lean()
  const items=records.flatMap((record:any)=> {
    const plan=planStandardUpdate(record,target,versions)
    if(!plan.matched || (!plan.changes.length && !plan.reason)) return []
    return [{ recordId:String(record._id),certNo:record.certNo||'',amedNo:record.amedNo,unitName:record.unitName,calDate:record.calDate,approvalStatus:record.approvalStatus,updatedAt:record.updatedAt,status:plan.status,reason:plan.reason,changes:plan.changes }]
  })
  const history=await CertificateRevision.find({instrumentRefId,referenceYear:year}).select('_id recordId certNo createdAt').sort({createdAt:-1}).limit(200).lean()
  return {versionId:String(target._id),items,history}
}
/** One confirmed item per request: failure leaves both issued data and PDF unchanged. */
export async function applyStandardUpdate(instrumentRefId:string,yearInput:unknown,input:any,actorId:string,render=renderCertificatePdf) {
  const {versions,target,year}=await context(instrumentRefId,yearInput)
  if(String(target._id)!==String(input.versionId)) throw new StandardYearError('ข้อมูลรายปีเปลี่ยนแล้ว กรุณากด Check update อีกครั้ง',409)
  const record=await CalibrationRecord.findById(input.recordId).lean() as any
  if(!record) throw new StandardYearError('ไม่พบรายการสอบเทียบ',404)
  const plan=planStandardUpdate(record,target,versions)
  if(!plan.matched) throw new StandardYearError('รายการนี้ไม่ได้อ้างอิงข้อมูลปีที่เลือก',409)
  if(plan.status==='manual') throw new StandardYearError(plan.reason,409)
  if(!plan.changes.length) return {ok:true,alreadyUpdated:true}
  if(!input.expectedUpdatedAt || new Date(input.expectedUpdatedAt).getTime()!==new Date(record.updatedAt).getTime()) throw new StandardYearError('รายการสอบเทียบเปลี่ยนแล้ว กรุณากด Check update อีกครั้ง',409)
  const nextRevision=Number(record.certificateRevision||0)+1
  const next={...record,...plan.patch,certificateRevision:nextRevision}
  const archived=await ArchivedCertificatePdf.findOne({recordId:String(record._id)}).lean() as any
  const oldPdf=archived?.pdfData && Number(archived.certificateRevision||0)===Number(record.certificateRevision||0) ? pdfBytes(archived.pdfData) : await render(record)
  const newPdf=await render(next)
  if(newPdf.subarray(0,5).toString()!=='%PDF-') throw new Error('Invalid rendered PDF')
  await mongoose.connection.transaction(async session=> {
    await mongoose.connection.db!.collection('stdinstrumentrefs').updateOne({_id:standardId(instrumentRefId)},{$inc:{standardYearEpoch:1}},{session})
    const currentVersion=await StandardInstrumentYear.findOne({instrumentRefId,year}).sort({revision:-1}).session(session).lean() as any
    if(String(currentVersion?._id)!==String(target._id)) throw new StandardYearError('ข้อมูลรายปีเปลี่ยนแล้ว กรุณาตรวจรายการใหม่',409)
    const updated=await CalibrationRecord.findOneAndUpdate({_id:record._id,updatedAt:record.updatedAt},{$set:{...plan.patch,certificateRevision:nextRevision}},{new:true,session})
    if(!updated) throw new StandardYearError('รายการสอบเทียบเปลี่ยนแล้ว กรุณาตรวจรายการใหม่',409)
    await CertificateRevision.create([{recordId:String(record._id),certNo:record.certNo,revision:Number(record.certificateRevision||0),recordSnapshot:record,pdfData:oldPdf,fileName:archived?.fileName||`calibration-${record.certNo||record._id}.pdf`,instrumentRefId,referenceYear:year,targetVersionId:String(target._id),changedBy:actorId}],{session})
    await ArchivedCertificatePdf.findOneAndUpdate({recordId:String(record._id)},{$set:{certNo:record.certNo||String(record._id),fileName:`calibration-${record.certNo||record._id}.pdf`,contentType:'application/pdf',pdfData:newPdf,certificateRevision:nextRevision}},{upsert:true,session})
  })
  return {ok:true,certificateRevision:nextRevision}
}
