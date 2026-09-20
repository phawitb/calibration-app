import { encode } from 'next-auth/jwt'
import { pdfBytes } from '../src/lib/pdfBytes'
import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import StandardInstrumentYear from '../src/models/StandardInstrumentYear'
import CalibrationRecord from '../src/models/CalibrationRecord'
import ArchivedCertificatePdf from '../src/models/ArchivedCertificatePdf'
import CertificateRevision from '../src/models/CertificateRevision'
import {saveStandardYear,listStandardYears,projectLatestStandards,uploadStandardYearPdf} from '../src/lib/standardYearService'
import {standardSnapshot} from '../src/lib/standardYears'
import {previewStandardUpdates,applyStandardUpdate} from '../src/lib/standardUpdateService'

test('annual persistence, optimistic revisions and confirmed certificate updates are atomic',async()=>{
 const uri=process.env.STANDARD_YEARS_TEST_URI
 assert.ok(uri?.includes('/standard_years_test?'),'Must use isolated test database')
 await mongoose.connect(uri!)
 try{
  await Promise.all([StandardInstrumentYear.init(),CalibrationRecord.init(),ArchivedCertificatePdf.init(),CertificateRevision.init()])
  const root={_id:new mongoose.Types.ObjectId(),no:'1021',name:'Reference',uT6:0.1,uT7:0.2,uT8:0.3,uT9:0.4,uT10:0.5,correction:1,certNo:'STD25',calDate:'2025-01-01'}
  await mongoose.connection.db!.collection('stdinstrumentrefs').insertOne(root)
  const id=String(root._id)
  const old=await saveStandardYear(id,{year:2568,expectedRevision:0,fields:root,calPoints:[]},'actor')
  const record=await CalibrationRecord.create({amedNo:'A',unitName:'Hospital',calibrationType:'sbcal',certNo:'CERT-1',approvalStatus:'approved',approvedById:'a'.repeat(24),std1:standardSnapshot(old),uc1:{std:standardSnapshot(old),calPoints:[{point:10,readings:[9,10,11,10],standards:[11,11,11,11],referenceStandards:[11,11,11,11],referencePoint:10}]}})
  for (const key of ['uT6','uT7','uT8','uT9','uT10']) {
    assert.equal((record.std1 as any)[key], (root as any)[key])
    assert.equal((record.uc1 as any).std[key], (root as any)[key])
    assert.equal(old.fields[key], (root as any)[key])
  }
  const prior=Buffer.from('%PDF-old-certificate')
  await ArchivedCertificatePdf.create({recordId:String(record._id),certNo:'CERT-1',fileName:'old.pdf',pdfData:prior})
  const future=await saveStandardYear(id,{year:2026,expectedRevision:0,fields:{...root,certNo:'STD26'},calPoints:[]},'actor')
  const updated=await saveStandardYear(id,{year:2025,expectedRevision:1,fields:{...root,correction:2},calPoints:[]},'actor')
  const projected=await projectLatestStandards([root]);assert.equal(projected[0].referenceYear,2026);assert.equal(projected[0].referenceVersionId,future._id)
  await assert.rejects(()=>saveStandardYear(id,{year:2568,expectedRevision:1,fields:root,calPoints:[]},'actor'),{status:409})
  assert.equal((await listStandardYears(id)).data.length,2)
  const preview=await previewStandardUpdates(id,2568)
  assert.equal(preview.items.length,1);assert.equal(preview.items[0].status,'ready',JSON.stringify(preview.items[0]))
  const request={versionId:updated._id,recordId:String(record._id),expectedUpdatedAt:preview.items[0].updatedAt}
  await assert.rejects(()=>applyStandardUpdate(id,2025,request,'actor',async()=>{throw Error('PDF unavailable')}),/PDF unavailable/)
  assert.equal((await CalibrationRecord.findById(record._id).lean() as any).uc1.std.correction,1)
  assert.equal(await CertificateRevision.countDocuments(),0)
  const createHistory = CertificateRevision.create
  try {
    CertificateRevision.create = async () => { throw new Error('History write failed') }
    await assert.rejects(()=>applyStandardUpdate(id,2025,request,'actor',async()=>Buffer.from('%PDF-rendered')),/History write failed/)
    assert.equal((await CalibrationRecord.findById(record._id).lean() as any).uc1.std.correction,1)
    assert.equal(pdfBytes((await ArchivedCertificatePdf.findOne({recordId:String(record._id)}).lean() as any).pdfData).toString(),prior.toString())
  } finally { CertificateRevision.create = createHistory }
  const result=await applyStandardUpdate(id,2025,request,'actor',async()=>Buffer.from('%PDF-new-certificate'))
  assert.equal(result.ok,true)
  const saved=await CalibrationRecord.findById(record._id).lean() as any
  assert.equal(saved.certNo,'CERT-1');assert.equal(saved.approvalStatus,'approved');assert.equal(saved.approvedById,'a'.repeat(24))
  assert.equal(saved.std1.referenceYear,2025);assert.equal(saved.uc1.std.correction,2)
  assert.deepEqual(saved.uc1.calPoints[0].readings,[9,10,11,10]);assert.deepEqual(saved.uc1.calPoints[0].standards,[12,12,12,12])
  const history=await CertificateRevision.findOne({recordId:String(record._id)}).select('+pdfData').lean() as any
  assert.equal(pdfBytes(history.pdfData).toString(),prior.toString());assert.equal(history.recordSnapshot.uc1.std.correction,1)
  assert.equal(pdfBytes((await ArchivedCertificatePdf.findOne({recordId:String(record._id)}).lean() as any).pdfData).toString(),'%PDF-new-certificate')
  assert.equal((await applyStandardUpdate(id,2025,request,'actor',async()=>Buffer.from('%PDF-unused'))).alreadyUpdated,true)
  assert.equal((await previewStandardUpdates(id,2025)).items.length,0)
  const pdf=new File(['%PDF-year-reference'],'reference.pdf',{type:'application/pdf'})
  const withPdf=await uploadStandardYearPdf(id,2025,pdf,2,'actor',{certNo:'REF',expiryDate:'2027-01-01'})
  assert.equal(withPdf.revision,3);assert.equal(withPdf.pdfData,undefined);assert.equal(withPdf.pdf.fileName,'reference.pdf')
  const nextPreview=await previewStandardUpdates(id,2025)
  await assert.rejects(()=>applyStandardUpdate(id,2025,{...request,versionId:withPdf._id,expectedUpdatedAt:new Date(0)},'actor'),{status:409})
  assert.equal(nextPreview.items.length,1)
  const concurrentlySaved=await Promise.allSettled([1,2].map(n=>saveStandardYear(id,{year:2025,expectedRevision:3,fields:{...root,name:`Updated ${n}`},calPoints:[]},'actor')))
  assert.equal(concurrentlySaved.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(concurrentlySaved.filter(r=>r.status==='rejected').length,1)
  const newest=(await listStandardYears(id)).data.find(v=>v.year===2025)
  assert.equal(newest.revision,4)
  const withBytes=await StandardInstrumentYear.findById(newest._id).select('+pdfData').lean() as any
  assert.equal(pdfBytes(withBytes.pdfData).toString(),'%PDF-year-reference')

  if(process.env.STANDARD_YEARS_TEST_BASE){
    const base=process.env.STANDARD_YEARS_TEST_BASE
    const token=await encode({secret:'standard-years-isolated-test-secret',token:{id:'b'.repeat(24),role:'admin',name:'Test Admin'}})
    const api=async(path:string,method='GET',body?:any,authenticated=true)=>fetch(base+path,{method,headers:{...(authenticated?{Cookie:`next-auth.session-token=${token}`} : {}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual'})
    const endpoint=`/api/admin/stdinstruments/${id}/years`
    assert.equal((await api(endpoint,'GET',undefined,false)).status,403)
    const savedVersion=await api(endpoint,'POST',{year:2025,expectedRevision:4,fields:{...root,name:newest.fields.name,uTStd:0.5},calPoints:[]})
    assert.equal(savedVersion.status,200,await savedVersion.clone().text())
    const httpPreview=await (await api(endpoint+'/2025/updates')).json()
    const item=httpPreview.items.find((r:any)=>r.recordId===String(record._id))
    assert.equal(item.status,'ready')
    const applied=await api(endpoint+'/2025/updates','POST',{versionId:httpPreview.versionId,recordId:item.recordId,expectedUpdatedAt:item.updatedAt})
    assert.equal(applied.status,200,await applied.clone().text())
    const issued=await api(`/api/certificates/${record._id}`)
    assert.equal(issued.status,200);assert.equal(issued.headers.get('content-type'),'application/pdf')
    assert.ok(Buffer.from(await issued.arrayBuffer()).subarray(0,5).equals(Buffer.from('%PDF-')))
    const stale=await api('/api/certificates/archive','POST',{recordId:String(record._id),certNo:'CERT-1',certificateRevision:0,recordUpdatedAt:record.updatedAt,fileDataUrl:'data:application/pdf;base64,'+Buffer.from('%PDF-stale').toString('base64')})
    assert.equal(stale.status,409)
    const latestRecord=await CalibrationRecord.findById(record._id).lean() as any
    assert.equal(latestRecord.certNo,'CERT-1');assert.equal(latestRecord.approvalStatus,'approved')
    const histories=await CertificateRevision.find({recordId:String(record._id)}).sort({revision:1}).lean() as any[]
    const historyPdf=await api(`/api/certificates/${record._id}?revisionId=${histories[0]._id}`)
    assert.equal(historyPdf.status,200);assert.equal(Buffer.from(await historyPdf.arrayBuffer()).toString(),prior.toString())
  }
  const withAttachment = {year:2027,expectedRevision:0,fields:{...root,calDate:'2027-02-03'},calPoints:[],pdfExpiryDate:'2028-02-03'}
  await assert.rejects(saveStandardYear(id,withAttachment,'actor',new File(['invalid'],'bad.pdf',{type:'application/pdf'})),/PDF/)
  assert.equal(await StandardInstrumentYear.countDocuments({instrumentRefId:id,year:2027}),0)
  const attached = await saveStandardYear(id,withAttachment,'actor',new File(['%PDF-combined'],'combined.pdf',{type:'application/pdf'}))
  const stored = await StandardInstrumentYear.findById(attached._id).select('+pdfData').lean() as any
  assert.equal(stored.revision,1)
  assert.equal(stored.fields.calDate,'2027-02-03')
  assert.equal(stored.pdf.fileName,'combined.pdf')
  assert.equal(stored.pdf.expiryDate,'2028-02-03')
  assert.equal(pdfBytes(stored.pdfData).toString(),'%PDF-combined')
 }finally{await mongoose.disconnect()}
})
