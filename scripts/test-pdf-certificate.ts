import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPdfCertificateInfo, PDF_LABELS } from '../src/lib/pdfCertificate'
import { formatPdfDate } from '../src/lib/pdfDate'

test('formats a date-only value as DD Mmm YYYY', () => {
  assert.equal(formatPdfDate('2026-08-01'), '01 Aug 2026')
})

test('removes the time from a date-time value', () => {
  assert.equal(formatPdfDate('2026-08-01T14:35:22.000Z'), '01 Aug 2026')
})

test('returns a dash for missing and invalid dates', () => {
  assert.equal(formatPdfDate(''), '-')
  assert.equal(formatPdfDate(null), '-')
  assert.equal(formatPdfDate('not-a-date'), '-')
})

test('builds corrected certificate labels and places Hospital No. in the device table', () => {
  const info = buildPdfCertificateInfo({
    deviceName: 'Thermometer',
    section: 'Ward 1',
    brand: 'Acme',
    model: 'T-1',
    serialNo: 'SN-1',
    amedNo: 'AM-1',
    hpNumber: 'HP-1',
    receivedN: 'REC-1',
    issuedDate: '2026-08-01T09:30:00.000Z',
    receivedDate: '2026-07-30T11:45:00.000Z',
    calDate: '2026-07-31T13:15:00.000Z',
    address: 'Bangkok',
  }, 'Example Hospital', 'Example Hospital')

  assert.deepEqual(info.deviceRows.map((row) => row.left.label), [
    'Equipment', 'Manufacturer', 'Serial No.', 'Hospital No.',
  ])
  assert.equal(info.deviceRows[3].left.value, 'HP-1')
  assert.equal(info.customerRows.some((row) => row.left.label === 'Hospital No.'), false)
  assert.equal(info.customerRows[2].left.label, 'Received No.')
  assert.equal(info.customerRows[2].right?.value, '01 Aug 2026')
  assert.equal(info.customerRows[3].left.value, '30 Jul 2026')
  assert.equal(info.customerRows[3].right?.value, '31 Jul 2026')
})

test('defines corrected labels for standard-instrument sections', () => {
  assert.equal(PDF_LABELS.manufacturer, 'Manufacturer')
  assert.equal(PDF_LABELS.measureUnit, 'Measure Unit')
})
