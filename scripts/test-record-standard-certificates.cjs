const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const {NextResponse} = require('next/server')
const mongoose = require('mongoose')
const id = 'a'.repeat(24), versionId = 'b'.repeat(24)
function route(user, record, certificate) {
  const queries = []
  const mocks = {
    'next/server': {NextResponse}, mongoose,
    'next-auth': {getServerSession: async () => user && ({user})},
    '@/lib/auth': {authOptions: {}}, '@/lib/mongodb': {connectDB: async () => {}},
    '@/lib/unitVariants': {getUnitVariants: async unit => [unit]},
    '@/lib/standardYears': {STANDARD_SLOTS: ['std1','uc1','uc2','uc3','uc4','uc5','uc6','ucT']},
    '@/lib/pdfBytes': {pdfBytes: value => Buffer.from(value)},
    '@/lib/contentDisposition': {inlineContentDisposition: () => 'inline'},
    '@/models/CalibrationRecord': {findById: () => ({select: () => ({lean: async () => record})})},
    '@/models/StandardInstrumentYear': {findOne: query => { queries.push(query); return {select: () => ({lean: async () => certificate})} }},
    '@/models/StdInstrumentCert': {},
  }
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync('src/app/api/records/[id]/standard-certificates/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
  new Function('require','exports',code)(key => {assert.ok(key in mocks,key);return mocks[key]},exports)
  return {queries, get: slot => exports.GET({nextUrl:new URL('http://localhost/api/test'+(slot?'?slot='+slot:''))},{params:{id}})}
}
const std = {no:'1021',certNo:'STD-2025',instrumentRefId:id,referenceYear:2025,referenceVersionId:versionId}
test('lists used slots and serves their exact annual PDF instead of latest',async()=>{
  const api=route({role:'hospital_user',hospitalUnit:'A'},{unitName:'A',std1:std,ucT:{std}}, {pdf:{fileName:'2025.pdf'},pdfData:Buffer.from('%PDF-reference')})
  const result=await api.get();assert.equal(result.status,200)
  const {data}=await result.json();assert.deepEqual(data.map(x=>x.slot),['std1','ucT']);assert.equal(data[0].year,2025);assert.equal(data[0].hasPdf,true)
  assert.deepEqual(api.queries[0],{_id:versionId,instrumentRefId:id,year:2025})
  const pdf=await api.get('ucT');assert.equal(pdf.headers.get('content-type'),'application/pdf');assert.equal(await pdf.text(),'%PDF-reference')
})
test('denies other hospitals, missing hospital assignment and unsigned users',async()=>{
  for(const user of [{role:'hospital_user',hospitalUnit:'B'},{role:'hospital_user'},null]){
    const api=route(user,{unitName:'A',std1:std},{});assert.equal((await api.get('std1')).status,user?403:401);assert.equal(api.queries.length,0)
  }
})
test('missing PDF is explicit and invalid slots cannot access unrelated documents',async()=>{
  const api=route({role:'admin'},{unitName:'A',std1:std},null)
  assert.equal((await (await api.get()).json()).data[0].hasPdf,false)
  assert.equal((await api.get('std1')).status,404)
  assert.equal((await api.get('other')).status,400)
})
