import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateRecord} from '../src/lib/calculateRecord'
import {normalizeStandardFields,standardSnapshot,planStandardUpdate} from '../src/lib/standardYears'
import CalibrationRecord from '../src/models/CalibrationRecord'
test('each instrument snapshot supplies its own divisor and survives record persistence casting',async()=>{
 const uc={std:{no:'STD',uTStd:2,divisorCalibrationStd:4},calPoints:[{point:10,readings:[10,10,10,10],standards:[10,10,10,10]}]}
 const model=new CalibrationRecord({uc1:uc})
 assert.equal((model.toObject() as any).uc1.std.divisorCalibrationStd,4)
 const a=await calculateRecord({calibrationType:'sbcal',uc1:uc})
 const b=await calculateRecord({calibrationType:'sbcal',uc1:{...uc,std:{...uc.std,divisorCalibrationStd:8}}})
 assert.ok(Math.abs(a.summary[0].U/b.summary[0].U-2)<1e-10)
})
test('annual save validates divisors and Check update replaces snapshot without changing readings',()=>{
 const fields=normalizeStandardFields({no:'STD',name:'Standard',correctionModel:'polynomial-v1',correctionA:0,correctionB:0,correctionC:0,correctionD:0,divisorCalibrationStd:4})
 assert.equal(fields.divisorRepeatUuc,1)
 assert.throws(()=>normalizeStandardFields({...fields,divisorCalibrationStd:0}))
 const before={_id:'v1',instrumentRefId:'i',year:2026,revision:1,fields,calPoints:[]}
 const after={...before,_id:'v2',revision:2,fields:{...fields,divisorCalibrationStd:8}}
 const uc={std:standardSnapshot(before),calPoints:[{point:1,readings:[1,2],standards:[1,2]}]}
 const plan=planStandardUpdate({uc1:uc},after,[before,after])
 assert.equal(plan.status,'ready')
 assert.equal(plan.patch.uc1.std.divisorCalibrationStd,8)
 assert.deepEqual(plan.patch.uc1.calPoints,uc.calPoints)
})
