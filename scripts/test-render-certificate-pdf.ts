import assert from 'node:assert/strict'
import test from 'node:test'
import { renderCertificatePdf } from '../src/lib/renderCertificatePdf'
import { calculateRecord } from '../src/lib/calculateRecord'
import IsoMethodTemplate from '../src/models/IsoMethodTemplate'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'

const standard = { name: 'Reference thermometer', no: 'STD-01', unit: '°C', measurement: 'Temperature', certNo: 'STD-2026', calDate: '2026-01-10', resolution: 0.01 }
const common = { certNo: 'CAL-2026-0001', unitName: 'Test Hospital', equipment: 'Thermometer', calDate: '2026-09-19', approvalStatus: 'approved', approve: 'Approver', std1: standard }

test('server renders real SbCal calculations into a PDF buffer', async () => {
  const record = { ...common, calibrationType: 'sbcal', uc1: { std: standard, calPoints: [{ point: 37, readings: [37.1, 37.2, 37.1, 37.2], standards: [37, 37, 37, 37] }] } }
  const calculated = await calculateRecord(record)
  assert.equal(calculated.calibrationType, 'sbcal')
  assert.equal(calculated.summary.length, 1)
  const pdf = await renderCertificatePdf(record)
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
  assert.ok(pdf.length > 5000)
})

test('server renders ISO method calculations without network or a database', async () => {
  const original = IsoMethodTemplate.findOne
  ;(IsoMethodTemplate as any).findOne = () => ({ lean: async () => ISO_METHOD_SEEDS.find(s => s.code === 'TEM-002') })
  try {
    const record = { ...common, calibrationType: 'iso', isoMethodCode: 'TEM-002', isoData: { uucResolution: 0.01, calPoints: [{ point: 37, sensorReadings: [[37, 37.1, 37.2, 37.1, 37], [37.1, 37.2, 37.1, 37, 37.1]], uucReadings: [37.1, 37.2] }] } }
    const calculated = await calculateRecord(record)
    assert.equal(calculated.isoResult.calPointResults.length, 1)
    const pdf = await renderCertificatePdf(record)
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
    assert.ok(pdf.length > 5000)
  } finally { IsoMethodTemplate.findOne = original }
})

test('signatures retain calibrator identity, name fallback, and approval gate', async () => {
  const { getCertificateSignatures } = await import('../src/lib/renderCertificatePdf')
  const { default: User } = await import('../src/models/User')
  const originalId = User.findById
  const originalOne = User.findOne
  ;(User as any).findById = (id: string) => ({ select: () => ({ lean: async () => ({ signaturePng: id === 'calibrator' ? 'calibrator-png' : id === 'approver' ? 'approver-png' : null }) }) })
  ;(User as any).findOne = () => ({ select: () => ({ lean: async () => ({ signaturePng: 'fallback-png' }) }) })
  try {
    assert.deepEqual(await getCertificateSignatures({ calibratedById: 'calibrator', approvedById: 'approver', approvalStatus: 'approved' }), { calibratorSignature: 'calibrator-png', approverSignature: 'approver-png' })
    assert.deepEqual(await getCertificateSignatures({ calibratedById: 'missing', calibrate: 'Technician', approvedById: 'approver', approvalStatus: 'pending' }), { calibratorSignature: 'fallback-png', approverSignature: null })
  } finally {
    User.findById = originalId
    User.findOne = originalOne
  }
})

test('legacy ISO certificates include every sensor result in actual PDF tables', async () => {
  const { execFileSync } = await import('node:child_process')
  const original = IsoMethodTemplate.findOne
  ;(IsoMethodTemplate as any).findOne = () => ({ lean: async () => null })
  try {
    const record = { ...common, calibrationType: 'iso', isoMethodCode: 'LEGACY-ISO', isoData: { calPoints: [{ point: 37, standardCorrection: 0.2, sensorReadings: [[37.4, 38.4], [37.6, 38.6]] }] } }
    const pdf = await renderCertificatePdf(record)
    const text = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf }).toString()
    assert.match(text, /CAL-2026-0001/)
    assert.match(text, /UUC reading/)
    assert.match(text, /Sensor 1/)
    assert.match(text, /Sensor 2/)
    assert.match(text, /37\.5/)
    assert.match(text, /38\.5/)
    assert.match(text, /37\.2/)
  } finally { IsoMethodTemplate.findOne = original }
})

test('ISO rendering rejects populated records without calculated results but allows empty drafts', async () => {
  const record = { ...common, calibrationType: 'iso', isoData: { calPoints: [{ point: 37, sensorReadings: [] }] } }
  await assert.rejects(renderCertificatePdf(record), /ISO.*results/i)
  const pdf = await renderCertificatePdf({ ...record, approvalStatus: 'draft', isoData: { calPoints: [] } })
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-')
})

test('configured certificate text appears in generated PDF without changing record data', async () => {
  const { CERTIFICATE_TEXT_FIELDS, defaultCertificateTexts } = await import('../src/lib/certificateTexts')
  const { execFileSync } = await import('node:child_process')
  const texts = {...defaultCertificateTexts}
  for (const [original, replacement] of [['Calibration Certificate','Custom Certificate Title'], ['Equipment','Custom Equipment'], ['Calibration Procedure','Custom Procedure']]) {
    const field = CERTIFICATE_TEXT_FIELDS.find(field => field.defaultValue === original)!
    texts[field.key] = replacement
  }
  const record = { ...common, calibrationType: 'sbcal', uc1: { std: standard, calPoints: [{ point:37, readings:[37.1,37.2],standards:[37,37] }] } }
  const before = JSON.stringify(record)
  const pdf = await renderCertificatePdf(record, texts)
  const text = execFileSync('pdftotext', ['-layout', '-', '-'], { input: pdf }).toString()
  assert.match(text,/Custom Certificate Title/)
  assert.match(text,/Custom Equipment/)
  assert.match(text,/Custom Procedure/)
  assert.match(text,/CAL-2026-0001/)
  assert.equal(JSON.stringify(record),before)
})
