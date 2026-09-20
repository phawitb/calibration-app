const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const {NextRequest,NextResponse} = require('next/server')
function route({user={role:'admin'}, archived=null, failure=false}={}) {
  let rendered=0
  const record={_id:'a'.repeat(24),unitName:'Hospital',certNo:'CERT1',certificateRevision:2,approvalStatus:'approved'}
  const chain = value => ({select:()=>({lean:async()=>value}),lean:async()=>value})
  const mocks={
    'next/server':{NextResponse},'next-auth':{getServerSession:async()=>({user})},
    '@/lib/auth':{authOptions:{}},'@/lib/mongodb':{connectDB:async()=>{}},
    '@/models/CalibrationRecord':{findById:()=>chain(record)},
    '@/models/ArchivedCertificatePdf':{findOne:()=>chain(archived)},'@/models/CertificateRevision':{},
    mongoose:{isValidObjectId:()=>true,connection:{db:null}},
    '@/lib/hospitalUnit':{formatHospitalUnitLabel:()=>''},'@/lib/contentDisposition':{inlineContentDisposition:()=> 'inline'},
    '@/lib/pdfBytes':{pdfBytes:x=>Buffer.from(x)},
    '@/lib/renderCertificatePdf':{renderCertificatePdf:async data=>{assert.equal(data.approvalStatus,'approved');rendered++;if(failure)throw Error('failed');return Buffer.from('%PDF-generated')}},
  }
  const code=ts.transpileModule(fs.readFileSync('src/app/api/certificates/[recordId]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
  const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name]},exports)
  return {get:()=>exports.GET(new NextRequest('http://localhost/api/certificates/'+record._id+'?download=1'),{params:{recordId:record._id}}),rendered:()=>rendered}
}
test('ZIP download gets real PDF when no current archive exists',async()=>{
  for(const archived of [null,{certificateRevision:1,pdfData:Buffer.from('%PDF-stale')}]){
    const api=route({archived}),r=await api.get();assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.equal(await r.text(),'%PDF-generated');assert.equal(api.rendered(),1)
  }
})
test('current archive is reused and rendering failure is explicit',async()=>{
  const api=route({archived:{certificateRevision:2,pdfData:Buffer.from('%PDF-current')}})
  assert.equal(await (await api.get()).text(),'%PDF-current');assert.equal(api.rendered(),0)
  assert.equal((await route({failure:true}).get()).status,422)
})
test('hospital users cannot download another hospital or without assigned hospital',async()=>{
  for(const user of [{role:'hospital_user'},{role:'hospital_user',hospitalUnit:'Other'}]){const api=route({user});assert.equal((await api.get()).status,403);assert.equal(api.rendered(),0)}
})
