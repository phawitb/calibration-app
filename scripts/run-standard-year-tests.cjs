const { spawn } = require('node:child_process')
const { mkdtemp,rm } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { MongoClient } = require('mongodb')
async function main(){
 const directory=await mkdtemp(path.join(tmpdir(),'calibration-years-test-'))
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve))
 const mongo=spawn('mongod',['--dbpath',directory,'--port',String(port),'--bind_ip','127.0.0.1','--replSet','standardYearsTest','--logpath',path.join(directory,'mongo.log')],{stdio:'ignore'})
 let failure;mongo.on('error',e=>{failure=e});const stopped=new Promise(resolve=>mongo.on('close',resolve))
 let client, app, appStopped
 try{
  for(let n=0;n<100;n++){if(failure)throw failure;try{client=new MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`,{serverSelectionTimeoutMS:300});await client.connect();break}catch{await client?.close();client=null;await new Promise(r=>setTimeout(r,100))}}
  if(!client)throw Error('Test MongoDB unavailable')
  await client.db('admin').command({replSetInitiate:{_id:'standardYearsTest',members:[{_id:0,host:`127.0.0.1:${port}`} ]}})
  let primary=false
  for(let n=0;n<100;n++){if((await client.db('admin').command({hello:1})).isWritablePrimary){primary=true;break}await new Promise(r=>setTimeout(r,100))}
  if(!primary)throw Error('Test replica set unavailable')
  let base=''
  if(process.env.STANDARD_YEARS_HTTP==='1'){
   const httpProbe=net.createServer();await new Promise(resolve=>httpProbe.listen(0,'127.0.0.1',resolve));const httpPort=httpProbe.address().port;await new Promise(resolve=>httpProbe.close(resolve))
   base=`http://127.0.0.1:${httpPort}`
   app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(httpPort)],{stdio:['ignore','ignore','pipe'],env:{...process.env,MONGODB_URI:`mongodb://127.0.0.1:${port}/standard_years_test?replicaSet=standardYearsTest`,NEXTAUTH_SECRET:'standard-years-isolated-test-secret',NEXTAUTH_URL:base}})
   appStopped=new Promise(resolve=>app.on('close',resolve))
   app.stderr.on('data',chunk=>process.stderr.write(chunk))
   let ready=false
   for(let n=0;n<100;n++){try{const r=await fetch(base+'/api/auth/session');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}
   if(!ready)throw Error('Isolated HTTP app unavailable')
  }
  const runner=spawn(process.execPath,['-r','sucrase/register','-r','./scripts/register-test-alias.cjs','--test','scripts/test-standard-years.ts','scripts/test-standard-year-service.ts'],{stdio:'inherit',env:{...process.env,STANDARD_YEARS_TEST_BASE:base,STANDARD_YEARS_TEST_URI:`mongodb://127.0.0.1:${port}/standard_years_test?replicaSet=standardYearsTest`}})
  process.exitCode=await new Promise(resolve=>runner.on('close',code=>resolve(code??1)))
 }finally{if(app){app.kill('SIGTERM');await appStopped}await client?.close();mongo.kill('SIGTERM');await stopped;await rm(directory,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1})
