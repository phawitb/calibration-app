import assert from 'node:assert/strict'
import test from 'node:test'
import { describeAcceptance, evaluatePoint, resolveMpeLimit, summarizeVerdicts } from '../src/lib/acceptance'

test('returns N/A when MPE is missing or values are not finite', () => {
  assert.equal(evaluatePoint(0.2, 0.1, undefined), 'na')
  assert.equal(evaluatePoint(0.2, 0.1, { mpe: '' }), 'na')
  assert.equal(evaluatePoint(0.2, 0.1, { mpe: 'abc' }), 'na')
  assert.equal(evaluatePoint(NaN, 0.1, { mpe: 1 }), 'na')
  assert.equal(evaluatePoint('', 0.1, { mpe: 1 }), 'na')
  assert.equal(evaluatePoint(0.2, undefined, { mpe: 1, includeUncertainty: true }), 'na')
  assert.equal(evaluatePoint(0.2, 0.1, { mpe: 1, mpeUnit: 'percent' }, NaN), 'na')
  assert.equal(evaluatePoint(0.2, 0.1, { mpe: -1 }), 'na')
})

test('absolute MPE compares |error| and optionally adds U', () => {
  assert.equal(evaluatePoint(0.4, 0.3, { mpe: 0.5 }), 'pass')
  assert.equal(evaluatePoint(-0.4, 0.3, { mpe: 0.5 }), 'pass')
  assert.equal(evaluatePoint(0.5, 0.3, { mpe: 0.5 }), 'pass')
  assert.equal(evaluatePoint(0.6, 0, { mpe: 0.5 }), 'fail')
  assert.equal(evaluatePoint(0.4, 0.3, { mpe: 0.5, includeUncertainty: true }), 'fail')
  assert.equal(evaluatePoint(0.1, 0.3, { mpe: 0.5, includeUncertainty: true }), 'pass')
  assert.equal(evaluatePoint('0.4', '0.3', { mpe: '0.5', mpeUnit: 'abs' }), 'pass')
})

test('percent MPE is relative to the reference value', () => {
  assert.equal(resolveMpeLimit({ mpe: 2, mpeUnit: 'percent' }, 100), 2)
  assert.equal(resolveMpeLimit({ mpe: 2, mpeUnit: 'percent' }, -50), 1)
  assert.equal(resolveMpeLimit({ mpe: 2, mpeUnit: 'percent' }, undefined), null)
  assert.equal(resolveMpeLimit({ mpe: 2, mpeUnit: '%' }, 100), 2)
  assert.equal(evaluatePoint(1.5, 0.2, { mpe: 2, mpeUnit: 'percent' }, 100), 'pass')
  assert.equal(evaluatePoint(2.5, 0.2, { mpe: 2, mpeUnit: 'percent' }, 100), 'fail')
  assert.equal(evaluatePoint(1.9, 0.2, { mpe: 2, mpeUnit: 'percent', includeUncertainty: true }, 100), 'fail')
})

test('overall verdict fails on any failure and is N/A without decided points', () => {
  assert.equal(summarizeVerdicts([]), 'na')
  assert.equal(summarizeVerdicts(['na', 'na']), 'na')
  assert.equal(summarizeVerdicts(['pass', 'na']), 'pass')
  assert.equal(summarizeVerdicts(['pass', 'fail', 'pass']), 'fail')
  assert.equal(summarizeVerdicts([{ verdict: 'pass' }, { verdict: 'na' }, null]), 'pass')
  assert.equal(summarizeVerdicts([{ verdict: 'na' }, { verdict: 'fail' }]), 'fail')
})

test('acceptance description for the certificate', () => {
  assert.equal(describeAcceptance(undefined), '')
  assert.equal(describeAcceptance({ mpe: 0.5 }, '°C'), 'MPE ± 0.5 °C')
  assert.equal(describeAcceptance({ mpe: 2, mpeUnit: 'percent', includeUncertainty: true }), 'MPE ± 2% (รวม U)')
  assert.equal(describeAcceptance({ mpe: 1, note: 'ตามคู่มือผู้ผลิต' }, 'mmHg'), 'MPE ± 1 mmHg - ตามคู่มือผู้ผลิต')
})

test('environment check uses std1 ranges first and falls back to configured defaults', async () => {
  const { evaluateEnvironment, assertEnvironmentForApproval, EnvironmentError } = await import('../src/lib/environmentCheck')
  const cfg = { requireEnvironment: true, envTempMin: 15, envTempMax: 35, envHumidMin: 20, envHumidMax: 80 }
  assert.equal(evaluateEnvironment({ lapTemp: 25, lapHumid: 55 }, cfg).ok, true)
  const missing = evaluateEnvironment({ lapTemp: '', lapHumid: 55 }, cfg)
  assert.equal(missing.ok, false)
  assert.match(missing.message, /ไม่ได้บันทึกอุณหภูมิ/)
  const outside = evaluateEnvironment({ lapTemp: 40, lapHumid: 55 }, cfg)
  assert.equal(outside.ok, false)
  assert.equal(outside.temp.source, 'config')
  const std = evaluateEnvironment({ lapTemp: 40, lapHumid: 55, std1: { tMin: 10, tMax: 45, hMin: 30, hMax: 70 } }, cfg)
  assert.equal(std.ok, true)
  assert.equal(std.temp.source, 'std1')
  assert.equal(evaluateEnvironment({ lapTemp: 40, lapHumid: 90 }, null).ok, false)
  assert.throws(() => assertEnvironmentForApproval({ lapTemp: 40, lapHumid: 55 }, cfg), EnvironmentError)
  assert.doesNotThrow(() => assertEnvironmentForApproval({ lapTemp: 40, lapHumid: 55 }, { ...cfg, requireEnvironment: false }))
})
