import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateIsoUncertainty } from '../src/lib/isoUncertainty'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'

const std1 = { correctionModel: 'polynomial-v1', correctionA: 0, correctionB: 1, correctionC: 0, correctionD: 1 }
const run = (code: string, cp: any, extras: any = {}) => calculateIsoUncertainty({
  methodTemplate: ISO_METHOD_SEEDS.find(s => s.code === code) as any,
  std1, uucResolution: 0, calPoints: [cp], ...extras,
} as any)!.calPointResults[0]
const probeCorrections = [{ probeId: 'P1', moduleId: 'M1', coefficients: { a: 0, b: 0, c: 0, d: 100 }, residual: 0 }]

test('comparison corrects each raw STD sample and never UUC or a second probe correction', () => {
  const p = run('ELC-001', { point: 100, sensorReadings: [[2], [4]], stdReadings: [[1], [3]], standardCorrection: 99 }, { probeCorrections })
  assert.equal(p.stdMean, 8) // mean(1 + 1² + 1, 3 + 3² + 1), not correction(mean)
  assert.equal(p.indicatingReading, 3)
  assert.equal(p.correction, 5)
  assert.equal(p.sensorResults[0].mean, 3)
})

test('spatial standard probes use polynomial once and preserve UUC displays', () => {
  const p = run('TEM-002', { point: 10, sensorReadings: [[1, 2, 3], [3, 4, 5]], uucReadings: [10, 12], verticalReadings: { center: [1, 3], top: [2, 4], bottom: [1, 3] } }, { probeCorrections })
  assert.equal(p.sensorResults[0].correctedMean, 8)
  assert.equal(p.stability, 9) // (31 - 13) / 2 for the third standard probe
  assert.equal(p.indicatingReading, 11)
  assert.equal(p.verticalUniformity, 6)
})

test('reference bath short term stability uses corrected STD on both sets', () => {
  const p = run('TEM-003-2', { point: 3, sensorReadings: [[3], [3]], stdReadings: [[1], [3]] }, {
    calRefPoints: [{ point: 0, sensorReadings: [[0], [0]], stdReadings: [[0], [2]] }],
  })
  assert.equal(p.stdMean, 8)
  const sts = p.uncertaintyBudget.find(s => s.key.includes('STS') || s.name.toLowerCase().includes('short'))
  assert.ok(sts)
  assert.equal(sts.value, 1) // |(8-3) - (4-0)|
})

test('polynomial comparison requires actual STD readings and ignores blanks', () => {
  assert.throws(() => run('ELC-001', { point: 10, sensorReadings: [[1]], stdReadings: [[null]] }), /STD/)
  const p = run('ELC-001', { point: 10, sensorReadings: [[1]], stdReadings: [[null], [0], [2]] })
  assert.equal(p.stdMean, 4)
})

test('Type K IRJ corrects both auxiliary standard readings without changing UUC', () => {
  const p = run('TEM-003-3', { point: 3, sensorReadings: [[3]], stdReadings: [[3]] }, {
    methodFields: { irjStd1: 1, irjUuc1: 1, irjStd2: 2, irjUuc2: 2 },
  })
  assert.equal(p.uncertaintyBudget.find(s => s.key === 'dT_IRJ')?.value, 3)
})

test('unused blank calibration rows do not become zero STD samples', () => {
  const result = calculateIsoUncertainty({
    methodTemplate: ISO_METHOD_SEEDS.find(s => s.code === 'ELC-001') as any,
    std1, uucResolution: 0,
    calPoints: [{ point: 0, sensorReadings: [[null]], stdReadings: [[null]] }],
  } as any)
  assert.deepEqual(result?.calPointResults, [])
})
