const {spawn} = require('node:child_process')
const {mkdtemp,rm} = require('node:fs/promises')
const {tmpdir} = require('node:os')
const path = require('node:path')
const net = require('node:net')
async function main() {
 const directory=await mkdtemp(path.join(tmpdir(),'calibration-orders-test-'))
 const probe=net.createServer()
 await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve))
 const port=probe.address().port
 await new Promise(resolve=>probe.close(resolve))
 const mongo=spawn('mongod',['--dbpath',directory,'--port',String(port),'--bind_ip','127.0.0.1','--logpath',path.join(directory,'mongo.log')],{stdio:'ignore'})
 let failure
 mongo.on('error',error=>{failure=error})
 const stopped=new Promise(resolve=>mongo.on('close',resolve))
 try {
  let ready=false
  for(let i=0;i<100;i++) {
   if(failure)throw new Error('ต้องมี mongod ในเครื่องเพื่อรันทดสอบฐานข้อมูลแยก')
   ready=await new Promise(resolve=>{const socket=net.connect(port,'127.0.0.1');socket.on('connect',()=>{socket.destroy();resolve(true)});socket.on('error',()=>{socket.destroy();resolve(false)})})
   if(ready)break
   await new Promise(resolve=>setTimeout(resolve,100))
  }
  if(!ready)throw Error('ไม่สามารถเริ่ม MongoDB ทดสอบได้')
  const tests=spawn(process.execPath,['-r','sucrase/register','-r','./scripts/register-test-alias.cjs','--test','scripts/test-work-order-validation.ts','scripts/test-work-order-service.ts'],{stdio:'inherit',env:{...process.env,WORK_ORDER_TEST_MONGO_URI:`mongodb://127.0.0.1:${port}/work_orders_test`}})
  process.exitCode=await new Promise(resolve=>tests.on('close',code=>resolve(code||0)))
 }finally{mongo.kill('SIGTERM');await stopped;await rm(directory,{recursive:true,force:true})}
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
