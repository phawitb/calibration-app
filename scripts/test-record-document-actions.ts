import assert from 'node:assert/strict'
import test from 'node:test'
import {
  firstPersonnelCertificateUrl,
  isRecordRowActionTarget,
  isRecordRowActivationKey,
  nextExpandedRecordId,
} from '../src/lib/recordDocumentActions'

test('clicking a collapsed row expands it and clicking it again collapses it', () => {
  assert.equal(nextExpandedRecordId(null, 'record-a'), 'record-a')
  assert.equal(nextExpandedRecordId('record-a', 'record-a'), null)
})

test('clicking another row replaces the currently expanded row', () => {
  assert.equal(nextExpandedRecordId('record-a', 'record-b'), 'record-b')
})

test('only Enter and Space activate a focused record row', () => {
  assert.equal(isRecordRowActivationKey('Enter'), true)
  assert.equal(isRecordRowActivationKey(' '), true)
  assert.equal(isRecordRowActivationKey('Escape'), false)
})

test('interactive action targets do not toggle their record row', () => {
  const actionTarget = { closest: (selector: string) => selector.includes('button') ? {} : null }
  const plainTarget = { closest: () => null }
  assert.equal(isRecordRowActionTarget(actionTarget as unknown as EventTarget), true)
  assert.equal(isRecordRowActionTarget(plainTarget as unknown as EventTarget), false)
})

test('the first personnel certificate is converted to its download URL', () => {
  assert.equal(
    firstPersonnelCertificateUrl('user-1', { data: [{ _id: 'cert-1' }, { _id: 'cert-2' }] }),
    '/api/users/user-1/certificates/cert-1',
  )
})

test('missing or malformed personnel certificates produce no URL', () => {
  assert.equal(firstPersonnelCertificateUrl('user-1', { data: [] }), null)
  assert.equal(firstPersonnelCertificateUrl('user-1', { data: [{}] }), null)
  assert.equal(firstPersonnelCertificateUrl('', { data: [{ _id: 'cert-1' }] }), null)
})
