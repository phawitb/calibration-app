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

 test('PDF uncertainty always rounds upward to two decimal places', async () => {
  const {formatPdfUncertainty}=await import('../src/lib/pdfUncertainty')
  for(const [value,expected] of [[0.645237,'0.65'],[1.001,'1.01'],[1.1,'1.10'],[1,'1.00'],[0,'0.00'],[1e-8,'0.01'],[0.29,'0.29']] as const) assert.equal(formatPdfUncertainty(value),expected)
  assert.equal(formatPdfUncertainty(59.999,true),'00:01:00.00')
  assert.equal(formatPdfUncertainty(NaN),'-')
})

test('reference date range is preserved without losing single-date formatting',async()=>{
 const {formatPdfStandardDate}=await import('../src/lib/pdfDate')
 assert.equal(formatPdfStandardDate('30 Sep - 2 Oct 2025'),'30 Sep - 2 Oct 2025')
 assert.equal(formatPdfStandardDate('2025-08-14 00:00:00'),'14 Aug 2025')
 assert.equal(formatPdfStandardDate('invalid'),'-')
})
