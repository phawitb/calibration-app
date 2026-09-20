/** One-time cutover. Stop application writes before --apply --delete-old-results.
 * Default is read-only. Preserves reference PDFs, previous versions and backups.
 */
require('dotenv').config({path:'.env.local'})
const {MongoClient,ObjectId}=require('mongodb')
const assert=require('node:assert/strict')
const targets=['calibrationrecords','archivedcertificatepdfs','amedcerthistories','certificaterevisions']
function polynomial(fields) {
  if(fields.correctionModel==='polynomial-v1') return null
  const d=fields.correction==null || fields.correction==='' ? 0 : Number(fields.correction)
  if(!Number.isFinite(d)) throw Error('Invalid legacy correction; migration stopped')
  return {correctionModel:'polynomial-v1',correctionA:0,correctionB:0,correctionC:0,correctionD:d}
}
async function main(){
 const client=new MongoClient(process.env.MONGODB_URI)
 await client.connect()
 try {
  const db=client.db(); const names=(await db.listCollections().toArray()).map(x=>x.name)
  const counts=Object.fromEntries(await Promise.all(names.map(async n=>[n,await db.collection(n).countDocuments()])))
  const roots=await db.collection('stdinstrumentrefs').find({}).toArray()
  const versions=await db.collection('standardinstrumentyears').find({}).sort({year:-1,revision:-1}).toArray()
  const seen=new Set(); const heads=versions.filter(v=>{const k=`${v.instrumentRefId}:${v.year}`;if(seen.has(k))return false;seen.add(k);return true})
  const rootChanges=roots.map(r=>({r,p:polynomial(r)})).filter(x=>x.p)
  const yearChanges=heads.map(v=>({v,p:polynomial(v.fields)})).filter(x=>x.p)
  const report={roots:rootChanges.length,annualVersions:yearChanges.length,delete:Object.fromEntries(targets.map(n=>[n,counts[n]||0])),reservedOrders:await db.collection('workorders').countDocuments({'usedDeviceIds.0':{$exists:true}})}
  console.log(JSON.stringify({mode:'preview',...report}))
  if(!process.argv.includes('--apply'))return
  if(!process.argv.includes('--delete-old-results'))throw Error('Explicit --delete-old-results flag required')
  const session=client.startSession()
  try {await session.withTransaction(async()=>{
   for(const name of names)assert.equal(await db.collection(name).countDocuments({}, {session}),counts[name],`Concurrent change: ${name}`)
   const now=new Date()
   if(rootChanges.length) await db.collection('stdinstrumentrefs').bulkWrite(rootChanges.map(({r,p})=>({updateOne:{filter:{_id:r._id},update:{$set:{...p,updatedAt:now},$unset:{correction:''},$inc:{standardYearEpoch:1}}}})),{session})
   if(yearChanges.length) await db.collection('standardinstrumentyears').insertMany(yearChanges.map(({v,p})=>{const fields={...v.fields,...p};delete fields.correction;return {...v,_id:new ObjectId(),fields,revision:v.revision+1,changedBy:'polynomial-cutover',createdAt:now,updatedAt:now}}),{session})
   for(const name of targets){const result=await db.collection(name).deleteMany({}, {session});assert.equal(result.deletedCount,counts[name]||0)}
   await db.collection('workorders').updateMany({'usedDeviceIds.0':{$exists:true}},{$set:{usedDeviceIds:[],updatedAt:now},$inc:{revision:1}},{session})
   for(const name of names){const expected=targets.includes(name)?0:name==='standardinstrumentyears'?counts[name]+yearChanges.length:counts[name];assert.equal(await db.collection(name).countDocuments({}, {session}),expected,`Postcondition: ${name}`)}
   assert.equal(await db.collection('workorders').countDocuments({'usedDeviceIds.0':{$exists:true}},{session}),0)
  })}finally{await session.endSession()}
  console.log(JSON.stringify({mode:'applied',...report,preservedCollectionCountsVerified:true}))
 }finally{await client.close()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
