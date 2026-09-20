import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStandardYear,latestStandardYears,standardSnapshot,planStandardUpdate } from '../src/lib/standardYears'
const old:any={_id:'old',instrumentRefId:'instrument',year:2025,revision:1,fields:{no:'1021',name:'STD',certNo:'S-25',calDate:'2025-01-01',correction:1,uTStd:0.1},calPoints:[]}
const changed:any={...old,_id:'new',revision:2,fields:{...old.fields,correction:2,uTStd:0.2}}
const fresh:any={...old,_id:'2026',year:2026,revision:1,fields:{...old.fields,certNo:'S-26',calDate:'2026-01-01'}}
function record(){return {certNo:'C-01',approvalStatus:'approved',uc1:{std:standardSnapshot(old),calPoints:[{point:10,readings:[9,10,11,10],standards:[11,11,11,11],referenceStandards:[11,11,11,11],referencePoint:10}]}}}
test('normalizes years and latest year is independent from revision order',()=>{
 assert.equal(normalizeStandardYear(2568),2025);assert.equal(normalizeStandardYear('2025'),2025)
 for(const y of [null,'',1,2025.5,'bad']) assert.throws(()=>normalizeStandardYear(y))
 assert.deepEqual(latestStandardYears([old,changed,fresh]).map(v=>v._id),['2026','new'])
})
test('updates generated STD but preserves measured UUC, identity and approval; repeat is no-op',()=>{
 const before=record();const plan=planStandardUpdate(before,changed,[old,changed,fresh])
 assert.equal(plan.status,'ready');assert.deepEqual(plan.patch.uc1.calPoints[0].standards,[12,12,12,12])
 assert.deepEqual(plan.patch.uc1.calPoints[0].readings,before.uc1.calPoints[0].readings)
 assert.equal('certNo' in plan.patch,false);assert.equal('approvalStatus' in plan.patch,false)
 assert.equal(planStandardUpdate({...before,...plan.patch},changed,[old,changed,fresh]).changes.length,0)
 assert.equal(planStandardUpdate(before,fresh,[old,changed,fresh]).matched,false)
})
test('manual/unknown STD and ambiguous legacy year require review rather than rewriting readings',()=>{
 const r=record();r.uc1.calPoints[0].standards[0]=10.8
 const plan=planStandardUpdate(r,changed,[old,changed]);assert.equal(plan.status,'manual');assert.equal(plan.patch.uc1.calPoints[0].standards[0],10.8)
 const legacy={std1:{no:'1021'}}
 assert.equal(planStandardUpdate(legacy,changed,[old,changed]).status,'manual')
 const ambiguous={std1:{...old.fields}}
 assert.equal(planStandardUpdate(ambiguous,changed,[old,changed,{...fresh,fields:old.fields}]).status,'manual')
})
test('all slots link to correct annual version, PDF-only changes retain every reading',()=>{
 const target={...old,_id:'pdf',revision:2,pdf:{fileName:'new.pdf'}}
 for(const key of ['std1','uc1','uc2','uc3','uc4','uc5','uc6','ucT']){
  const slot=key==='std1'?standardSnapshot(old):record().uc1
  const plan=planStandardUpdate({[key]:slot},target,[old,target])
  assert.equal(plan.status,'ready');assert.equal(plan.changes.length,1)
  if(key!=='std1') assert.deepEqual(plan.patch[key].calPoints,record().uc1.calPoints)
 }
})
