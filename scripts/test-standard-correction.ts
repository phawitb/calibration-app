import test from 'node:test'
import assert from 'node:assert/strict'
import {correctStandardReading,getStandardCoefficients,evaluateStandardCorrection} from '../src/lib/standardCorrection'
import {calculateCalPointBudget,STANDARD_FORMULA} from '../src/lib/uncertainty'
const coeffs={a:0.1,b:0.2,c:-0.3,d:0.4}
test('uses raw read as x and applies cubic correction exactly once',()=>{
 const result=evaluateStandardCorrection(2,coeffs)
 assert.ok(Math.abs(result.correction-1.4)<1e-12)
 assert.ok(Math.abs(result.trueValue-3.4)<1e-12)
 assert.deepEqual(evaluateStandardCorrection(-2,{a:0,b:0,c:0,d:0}),{read:-2,correction:0,trueValue:-2})
 assert.equal(correctStandardReading(10,{correction:0.5}).trueValue,10.5)
})
test('missing coefficients, invalid read and overflow cannot silently become zero',()=>{
 assert.throws(()=>getStandardCoefficients({correctionModel:'polynomial-v1',correctionA:0}),/สัมประสิทธิ์ B/)
 assert.throws(()=>evaluateStandardCorrection(NaN,coeffs))
 assert.throws(()=>evaluateStandardCorrection(1e200,coeffs))
 assert.deepEqual(getStandardCoefficients({correctionModel:'polynomial-v1',correctionA:'1e-6',correctionB:0,correctionC:0,correctionD:0}),{a:1e-6,b:0,c:0,d:0})
})
test('budget corrects each sample before averaging and preserves raw readings',()=>{
 const input={point:2,uucReadings:[1,3],stdReadings:[1,3]}
 const before=JSON.stringify(input)
 const result=calculateCalPointBudget(input,{stdCorrection:999,coefficients:{a:0,b:1,c:0,d:0},uTStd:0,uTDrif:0,uTResStd:0,uTUuc:0,uTInt:0},{...STANDARD_FORMULA,numReadings:2})
 assert.equal(result.avgSTD,2)
 assert.equal(result.avgSTDRead,7) // mean(1+1^2, 3+3^2), not 2+2^2
 assert.equal(result.correction,5)
 assert.equal(result.stdCorrection,5)
 assert.equal(JSON.stringify(input),before)
})

test('yearly polynomial update replaces coefficient snapshot but never rewrites raw readings', async () => {
 const {planStandardUpdate,standardSnapshot,normalizeStandardFields}=await import('../src/lib/standardYears')
 const fields={no:'STD',name:'Reference',correctionModel:'polynomial-v1',correctionA:0,correctionB:0,correctionC:0,correctionD:0}
 const before={_id:'v1',instrumentRefId:'i',year:2026,revision:1,fields,calPoints:[]}
 const after={...before,_id:'v2',revision:2,fields:{...fields,correctionB:1}}
 const record={std1:standardSnapshot(before),uc1:{std:standardSnapshot(before),calPoints:[{point:2,standards:[1,3],readings:[2,4]}]}}
 const plan=planStandardUpdate(record,after,[after,before])
 assert.equal(plan.status,'ready')
 assert.deepEqual(plan.patch.uc1.calPoints,record.uc1.calPoints)
 assert.equal(plan.patch.uc1.std.correctionB,1)
 assert.throws(()=>normalizeStandardFields({...fields,correctionC:''}),/สัมประสิทธิ์ C/)
})

test('new records reject UUC data without an actual STD read', async () => {
 const {calculateAllUcComponents}=await import('../src/lib/uncertainty')
 const std={no:'STD',correctionModel:'polynomial-v1',correctionA:0,correctionB:0,correctionC:0,correctionD:0}
 assert.throws(()=>calculateAllUcComponents({uc1:{std,calPoints:[{point:0,readings:[0],standards:['']}]}}),/STD Read/)
 assert.equal(calculateAllUcComponents({uc1:{std,calPoints:[{point:0,readings:[0,0],standards:[0,0]}]}}).uc1.points.length,1)
})
