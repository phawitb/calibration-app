import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canManageOrders,
  validateWorkOrderInput,
  validateOrderPdf,
  assertRecordOrderIdentity,
  projectOrderForHospital,
} from '../src/lib/workOrderValidation'
const id = 'a'.repeat(24),
  dev = 'b'.repeat(24)
const good = {
  orderNo: ' 1/69 ',
  title: 'ตรวจสอบ',
  startDate: '2026-09-19',
  endDate: '2026-09-20',
  notes: '',
  hospitals: [{ unitName: 'รพ. A', deviceIds: [dev] }],
  memberIds: [id],
}
test('only administrators and technicians manage orders', () => {
  for (const role of ['admin', 'technician'])
    assert.equal(canManageOrders(role), true)
  for (const role of ['hospital_user', 'approver', undefined])
    assert.equal(canManageOrders(role), false)
})
test('normalizes valid input without trusting audit fields', () => {
  assert.equal(
    validateWorkOrderInput({ ...good, createdBy: 'fake' }).orderNo,
    '1/69'
  )
  assert.equal('createdBy' in validateWorkOrderInput(good), false)
})
test('rejects incomplete, reversed, impossible dates and invalid associations', () => {
  for (const value of [
    {},
    { ...good, endDate: '2026-09-18' },
    { ...good, startDate: '2026-02-30' },
    { ...good, memberIds: [] },
    { ...good, memberIds: ['bad'] },
    { ...good, hospitals: [] },
    { ...good, hospitals: [{ unitName: 'A', deviceIds: [] }] },
    { ...good, memberIds: [id, id] },
    { ...good, hospitals: [good.hospitals[0], good.hospitals[0]] },
  ])
    assert.throws(() => validateWorkOrderInput(value))
})
test('PDF type, signature and size are checked', () => {
  const bytes = Buffer.from('%PDF-1.7\n')
  assert.doesNotThrow(() =>
    validateOrderPdf({ type: 'application/pdf', size: bytes.length }, bytes)
  )
  for (const file of [
    { type: 'text/plain', size: 9 },
    { type: 'application/pdf', size: 8388609 },
    { type: 'application/pdf', size: 0 },
  ])
    assert.throws(() => validateOrderPdf(file, bytes))
  assert.throws(() =>
    validateOrderPdf({ type: 'application/pdf', size: 5 }, Buffer.from('hello'))
  )
})
test('record order and device cannot be reassigned or detached', () => {
  const record = {
    workOrderId: id,
    workOrderDeviceId: dev,
    unitName: 'A',
    amedNo: '1',
    serialNo: 's',
  }
  assert.doesNotThrow(() => assertRecordOrderIdentity(record, { notes: 'ok' }))
  for (const patch of [
    { workOrderId: '' },
    { workOrderDeviceId: id },
    { unitName: 'B' },
    { amedNo: '2' },
    { serialNo: 'different' },
  ])
    assert.throws(() => assertRecordOrderIdentity(record, patch))
  assert.throws(() => assertRecordOrderIdentity({}, { workOrderId: id }))
})
test('hospital projection never includes other hospitals', () => {
  const order = {
    hospitals: [
      { unitName: 'A', deviceIds: [dev] },
      { unitName: 'B', deviceIds: [id] },
    ],
    devices: [
      { unitName: 'A', _id: dev },
      { unitName: 'B', _id: id },
    ],
  }
  const visible = projectOrderForHospital(order, ['A'])
  assert.equal(visible.hospitals.length, 1)
  assert.equal(visible.devices.length, 1)
  assert.equal(projectOrderForHospital(order, ['C']), null)
})
import { buildUnsavedDraftQuery } from '../src/lib/recordLifecycle'
import {
  selectedVisibleOrder,
  orderStorageKey,
} from '../src/lib/workspaceOrder'
test('unsaved draft identity includes order and registry device', () => {
  const query = buildUnsavedDraftQuery({
    createdBy: 'a',
    unitName: 'A',
    calibrationType: 'iso',
    isoMethodCode: 'x',
    workOrderId: id,
    workOrderDeviceId: dev,
  })
  assert.equal(query?.workOrderId, id)
  assert.equal(query?.workOrderDeviceId, dev)
})
test('remembered order must be visible and storage is account scoped', () => {
  assert.equal(selectedVisibleOrder([], id), null)
  assert.notEqual(orderStorageKey('admin'), orderStorageKey('hospital'))
})

import {resolveWorkspaceHospitals} from '../src/lib/workspaceOrder'
test('history includes legacy hospitals even with an order, restricted accounts keep their own hospital',()=>{
 const options={historical:true,locked:false,hospitalUnit:'B',allHospitals:['A','B','Legacy'],orderHospitals:['A']}
 assert.deepEqual(resolveWorkspaceHospitals(options),['A','B','Legacy'])
 assert.deepEqual(resolveWorkspaceHospitals({...options,locked:true}),['B'])
 assert.deepEqual(resolveWorkspaceHospitals({...options,historical:false}),['A'])
})
