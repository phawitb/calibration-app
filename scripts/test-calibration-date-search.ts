import assert from 'node:assert/strict'
import test from 'node:test'
import { calibrationDateRange, calibrationDateSearch } from '../src/lib/calibrationDateSearch'

test('Buddhist year covers the full Common Era calendar year with an exclusive end', () => {
  const range = calibrationDateRange('2569')!
  assert.equal(range.$gte.toISOString(), '2026-01-01T00:00:00.000Z')
  assert.equal(range.$lt.toISOString(), '2027-01-01T00:00:00.000Z')
  assert.deepEqual(range, calibrationDateRange('2026'))
})
test('displayed Thai dates, padded dates and ISO dates find the same day', () => {
  const range = calibrationDateRange('19/9/2569')!
  assert.equal(range.$gte.toISOString(), '2026-09-19T00:00:00.000Z')
  assert.equal(range.$lt.toISOString(), '2026-09-20T00:00:00.000Z')
  for (const value of ['19/09/2569', '19/9/2026', '2026-09-19']) assert.deepEqual(calibrationDateRange(value), range)
})
test('invalid dates and ordinary searches do not become calendar filters', () => {
  for (const value of ['31/2/2569', '29/2/2569', '0/1/2569', '19/13/2569', 'Thermometer', '256']) assert.equal(calibrationDateRange(value), null)
  assert.ok(calibrationDateRange('29/2/2567'))
})

test('day/month search matches across years and accepts optional zero padding', () => {
  const query = calibrationDateSearch('19/9')!
  assert.deepEqual(query, calibrationDateSearch('19/09'))
  assert.deepEqual((query as any).$expr.$and.map((term: any) => term.$eq[1]), [19, 9])
  assert.ok(calibrationDateSearch('29/2'))
  for (const value of ['31/2', '0/9', '19/13']) assert.equal(calibrationDateSearch(value), null)
  assert.deepEqual(calibrationDateSearch('19/9/2569'), {calDate: calibrationDateRange('19/9/2569')})
})
