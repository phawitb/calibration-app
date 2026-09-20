import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateCalPointBudget,STANDARD_FORMULA} from '../src/lib/uncertainty'
import {validateComponentDivisors} from '../src/lib/formulaDivisors'
const std={stdCorrection:0,uTStd:2,uTDrif:3,uTResStd:4,uTUuc:5,uTInt:6}
test('repeatability counts finite samples independently and Vi is N minus one',()=>{
 const r=calculateCalPointBudget({point:0,uucReadings:[0,2,NaN],stdReadings:[0,2,4,NaN]},std,{...STANDARD_FORMULA,numReadings:99})
 assert.equal(r.components[0].vi,1)
 assert.equal(r.components[1].vi,2)
 assert.ok(Math.abs(r.uTRepUUC-1)<1e-12)
 assert.ok(Math.abs(r.uTRepSTD-2/Math.sqrt(3))<1e-12)
 const denominator=r.components[0].ui**4+r.components[1].ui**4/2
 assert.ok(Math.abs(r.veff-r.uc**4/denominator)<1e-9)
})
test('each divisor affects its own ui and the combined budget',()=>{
 const componentDivisors={repeatUuc:2,repeatStd:3,calibrationStd:4,drift:5,resolutionStd:6,resolutionUuc:7,interpolation:8}
 const r=calculateCalPointBudget({point:0,uucReadings:[1,2,3,4],stdReadings:[1,2,3,4]},std,{...STANDARD_FORMULA,componentDivisors})
 assert.deepEqual(r.components.map(c=>c.divisor),[2,3,4,5,6,7,8])
 for(const c of r.components){assert.equal(c.ui,c.value/c.divisor);assert.equal(c.ui2,c.ui**2)}
 assert.equal(r.components[0].vi,3)
})
test('invalid divisor and insufficient samples are rejected',()=>{
 for(const value of [0,-1,NaN,Infinity,'2',null])assert.throws(()=>validateComponentDivisors({repeatUuc:value}))
 assert.throws(()=>calculateCalPointBudget({point:0,uucReadings:[1],stdReadings:[1,2]},std),/2/)
})
