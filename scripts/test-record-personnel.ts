import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatApproverOption,
  shouldSessionOwnCalibration,
} from '../src/lib/recordPersonnel'

test('only a technician session may replace the record calibrator', () => {
  assert.equal(shouldSessionOwnCalibration('technician'), true)
  assert.equal(shouldSessionOwnCalibration('approver'), false)
  assert.equal(shouldSessionOwnCalibration('admin'), false)
  assert.equal(shouldSessionOwnCalibration('hospital_user'), false)
})

test('approver option does not repeat a rank already included in the full name', () => {
  assert.equal(
    formatApproverOption({ rankEn: 'Col.', fullNameEn: 'Col. Prasit Rattanachot', role: 'approver' }),
    'Col. Prasit Rattanachot (approver)',
  )
})

test('approver option prepends a separate rank when the full name omits it', () => {
  assert.equal(
    formatApproverOption({ rankEn: 'Col.', fullNameEn: 'Prasit Rattanachot', role: 'approver' }),
    'Col. Prasit Rattanachot (approver)',
  )
})
