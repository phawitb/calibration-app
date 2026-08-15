import assert from 'node:assert/strict'
import test from 'node:test'
import {
  closeReservedDocumentPopup,
  firstPersonnelCertificateUrl,
  isRecordRowActionTarget,
  loadPersonnelCertificateIntoPopup,
  navigateReservedDocumentPopup,
  nextExpandedRecordId,
  reserveDocumentPopup,
} from '../src/lib/recordDocumentActions'

test('clicking a collapsed row expands it and clicking it again collapses it', () => {
  assert.equal(nextExpandedRecordId(null, 'record-a'), 'record-a')
  assert.equal(nextExpandedRecordId('record-a', 'record-a'), null)
})

test('clicking another row replaces the currently expanded row', () => {
  assert.equal(nextExpandedRecordId('record-a', 'record-b'), 'record-b')
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

test('reserving a personnel certificate popup opens a blank tab and isolates its opener', () => {
  const popup = {
    opener: { location: 'parent' } as unknown,
    location: { href: 'about:blank' },
    close: () => {},
  }
  const calls: Array<[string, string]> = []

  const reserved = reserveDocumentPopup((url, target) => {
    calls.push([url, target])
    return popup
  })

  assert.deepEqual(calls, [['', '_blank']])
  assert.equal(reserved, popup)
  assert.equal(popup.opener, null)
})

test('a blocked personnel certificate popup produces no reserved tab', () => {
  assert.equal(reserveDocumentPopup(() => null), null)
})

test('a reserved personnel certificate popup can be navigated or closed', () => {
  let closeCount = 0
  const popup = {
    opener: null,
    location: { href: 'about:blank' },
    close: () => { closeCount += 1 },
  }

  navigateReservedDocumentPopup(popup, '/api/users/user-1/certificates/cert-1')
  assert.equal(popup.location.href, '/api/users/user-1/certificates/cert-1')

  closeReservedDocumentPopup(popup)
  assert.equal(closeCount, 1)
})

test('a successful personnel certificate lookup navigates the reserved popup', async () => {
  let closeCount = 0
  const requestedUrls: string[] = []
  const popup = {
    opener: null,
    location: { href: 'about:blank' },
    close: () => { closeCount += 1 },
  }

  const result = await loadPersonnelCertificateIntoPopup('user-1', popup, async (url) => {
    requestedUrls.push(url)
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ _id: 'cert-1' }] }),
    }
  })

  assert.equal(result, 'opened')
  assert.deepEqual(requestedUrls, ['/api/users/user-1/certificates'])
  assert.equal(popup.location.href, '/api/users/user-1/certificates/cert-1')
  assert.equal(closeCount, 0)
})

test('empty or malformed certificate data closes the reserved popup', async () => {
  for (const payload of [{ data: [] }, { data: [{}] }, {}]) {
    let closeCount = 0
    const popup = {
      opener: null,
      location: { href: 'about:blank' },
      close: () => { closeCount += 1 },
    }

    const result = await loadPersonnelCertificateIntoPopup('user-1', popup, async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }))

    assert.equal(result, 'missing')
    assert.equal(popup.location.href, 'about:blank')
    assert.equal(closeCount, 1)
  }
})

test('HTTP and thrown certificate lookup failures close the reserved popup', async () => {
  const cases = [
    async () => ({ ok: false, status: 503, json: async () => ({ data: [] }) }),
    async () => { throw new Error('network unavailable') },
    async () => ({ ok: true, status: 200, json: async () => { throw new Error('invalid JSON') } }),
  ]

  for (const loadCertificateList of cases) {
    let closeCount = 0
    const popup = {
      opener: null,
      location: { href: 'about:blank' },
      close: () => { closeCount += 1 },
    }

    const result = await loadPersonnelCertificateIntoPopup('user-1', popup, loadCertificateList)

    assert.equal(result, 'failed')
    assert.equal(popup.location.href, 'about:blank')
    assert.equal(closeCount, 1)
  }
})
