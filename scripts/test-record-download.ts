import test from 'node:test'
import assert from 'node:assert/strict'
import {zipSync, unzipSync} from 'fflate'
import {collectRecordDocuments, downloadDocumentFiles, safeZipName} from '../src/lib/recordDownload'

test('manifest contains only visible records, all available personnel PDFs and exact standard links', async () => {
  const calls: string[] = []
  const docs = await collectRecordDocuments([{_id:'a',certNo:'ใบเซอร์/1',calibratedById:'person',approvedById:'person'}, {_id:'b',certNo:'ใบเซอร์/1',deviceName:'Second device'}],async url => {
    calls.push(url)
    if(url.includes('/users/')) return {data:[{_id:'one',fileName:'one.pdf'},{_id:'two',fileName:'two.pdf'}]}
    return {data:[{slot:'uc1',no:'1021',certNo:'STD25',hasPdf:true,documentKey:'annual:shared-version'},{slot:'uc2',no:'1022',hasPdf:false}]}
  })
  assert.equal(calls.filter(url=>url.includes('/users/')).length,1)
  assert.deepEqual(Array.from(new Set(docs.map(doc=>doc.recordId))),['a','b'])
  assert.equal(docs.filter(doc=>doc.url?.includes('/users/')).length,2)
  assert.equal(docs.filter(doc=>doc.documentKey==='annual:shared-version').length,1)
  assert.equal(docs.find(doc=>doc.documentKey==='annual:shared-version')?.usedBy?.length,2)
  assert.deepEqual(docs.find(doc=>doc.url?.includes('/users/'))?.usedAs,['เซอร์ผู้สอบ','เซอร์ผู้อนุมัติ'])
  assert.ok(docs.some(doc=>doc.url==='/api/records/a/standard-certificates?slot=uc1'))
  assert.equal(docs.find(doc=>doc.id==='a:standard-uc2')?.url,undefined)
  assert.equal(new Set(docs.map(doc=>doc.path)).size,docs.length)
  assert.ok(!safeZipName('../../unsafe/file').includes('/'))
  const selected = docs.filter(doc=>doc.url).slice(0,2)
  const fetched:string[] = [], progress:number[] = []
  const files = await downloadDocumentFiles(selected,async url=>{fetched.push(url);return new TextEncoder().encode('%PDF-test')},done=>progress.push(done))
  const zip = zipSync(files)
  const unpacked = unzipSync(zip)
  assert.deepEqual(Object.keys(unpacked),selected.map(doc=>doc.path))
  assert.equal(fetched.length,2);assert.deepEqual(progress,[1,2])
  for(const bytes of Object.values(unpacked)) assert.equal(new TextDecoder().decode(bytes),'%PDF-test')
})
test('does not silently omit metadata failures or archive HTML instead of PDF', async () => {
  const partial = await collectRecordDocuments([{_id:'a',calibratedById:'person'}],async()=>{throw Error('offline')})
  assert.equal(partial.filter(doc=>doc.url).length,1)
  assert.equal(partial.filter(doc=>doc.loadError).length,2)
  assert.ok(partial.some(doc=>doc.id==='a:certificate'))
  await assert.rejects(downloadDocumentFiles([{id:'a',recordId:'a',recordLabel:'A',label:'Certificate',url:'/pdf',path:'a.pdf'}],async()=>new TextEncoder().encode('<html>login</html>'),()=>{}),/ไม่ใช่ PDF/)
})
