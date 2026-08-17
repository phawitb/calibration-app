import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildUnsavedDraftQuery,
  shouldAssignCertificateNumber,
  stripClientNumberFields,
  withSavedRecords,
} from '../src/lib/recordLifecycle'

test('matches an unsaved SbCal record owned by the same user and hospital', () => {
  assert.deepEqual(buildUnsavedDraftQuery({
    createdBy: ' tech1 ',
    unitName: ' Hospital A ',
    calibrationType: 'sbcal',
    amedNo: ' 11299555 ',
  }), {
    createdBy: 'tech1',
    unitName: 'Hospital A',
    calibrationType: 'sbcal',
    amedNo: '11299555',
    savedOnce: false,
  })
})

test('matches an unsaved ISO record by method instead of AMED No.', () => {
  assert.deepEqual(buildUnsavedDraftQuery({
    createdBy: 'tech1',
    unitName: 'Hospital A',
    calibrationType: 'iso',
    isoMethodCode: ' TEM-004 ',
  }), {
    createdBy: 'tech1',
    unitName: 'Hospital A',
    calibrationType: 'iso',
    isoMethodCode: 'TEM-004',
    savedOnce: false,
  })
})

test('does not match a temporary record without its type-specific identity', () => {
  assert.equal(buildUnsavedDraftQuery({
    createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'sbcal',
  }), null)
  assert.equal(buildUnsavedDraftQuery({
    createdBy: 'tech1', unitName: 'Hospital A', calibrationType: 'iso',
  }), null)
})

test('assigns a certificate number only for the first approval request', () => {
  assert.equal(shouldAssignCertificateNumber('draft', ''), false)
  assert.equal(shouldAssignCertificateNumber('request_approval', ''), true)
  assert.equal(shouldAssignCertificateNumber('request_approval', 'CERT-000150/2026'), false)
})

test('removes client-supplied server-owned numbering fields', () => {
  assert.deepEqual(stripClientNumberFields({
    deviceName: 'Thermometer',
    certNo: 'CLIENT-CERT',
    amedCertKey: 'CLIENT-KEY',
  }), { deviceName: 'Thermometer' })
})

test('adds the saved-record visibility rule without losing existing scope', () => {
  assert.deepEqual(withSavedRecords({ createdBy: 'tech1', approvalStatus: 'draft' }), {
    createdBy: 'tech1',
    approvalStatus: 'draft',
    savedOnce: { $ne: false },
  })
  assert.deepEqual(withSavedRecords({ savedOnce: false, unitName: 'Hospital A' }), {
    savedOnce: { $ne: false },
    unitName: 'Hospital A',
  })
})
