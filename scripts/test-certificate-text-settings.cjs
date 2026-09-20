const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const {NextRequest,NextResponse}=require('next/server')
const {validateCertificateTexts,defaultCertificateTexts}=require('../src/lib/certificateTexts')
function api(role){
 let config=null
 const mocks={
  'next/server':{NextResponse},'next-auth':{getServerSession:async()=>role?{user:{role,id:'actor'}}:null},
  '@/lib/auth':{authOptions:{}},'@/lib/mongodb':{connectDB:async()=>{}},
  '@/lib/certificateTexts':{validateCertificateTexts},
  '@/lib/certificateTextService':{getCertificateTextConfig:async()=>({texts:{...defaultCertificateTexts,...config?.texts},revision:config?.revision||0})},
  '@/models/CertificateTextConfig':{
   create:async value=>{if(config)throw {code:11000};config=value},
   findOneAndUpdate:async(query,update)=>{if(config?.revision!==query.revision)return null;config={...config,...update.$set,revision:config.revision+1};return config},
  },
 }
 const code=ts.transpileModule(fs.readFileSync('src/app/api/certificate-texts/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name]},exports)
 return {...exports,save:(body)=>exports.PATCH(new NextRequest('http://localhost/api/certificate-texts',{method:'PATCH',body:JSON.stringify(body)}))}
}
test('signed-in viewers can read settings, only data managers can change them',async()=>{
 assert.equal((await api(null).GET()).status,401)
 assert.equal((await api('hospital_user').GET()).status,200)
 for(const role of [null,'hospital_user','approver'])assert.equal((await api(role).save({texts:{},revision:0})).status,403)
})
test('text settings persist and stale writers cannot overwrite newer text',async()=>{
 const route=api('admin')
 assert.equal((await route.GET()).status,200)
 const created=await route.save({texts:{text01:'Test organization'},revision:0});assert.equal(created.status,200)
 assert.equal((await created.json()).texts.text01,'Test organization')
 assert.equal((await route.save({texts:{text01:'stale'},revision:0})).status,409)
 assert.equal((await route.save({texts:{text01:'Revised'},revision:1})).status,200)
 assert.equal((await route.save({texts:{text01:'stale'},revision:1})).status,409)
 assert.equal((await (await route.GET()).json()).texts.text01,'Revised')
 assert.equal((await route.save({texts:{text01:42},revision:2})).status,400)
})
