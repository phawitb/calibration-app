/**
 * Test script: verify ISO uncertainty engine against Water Bath Excel data
 * File: Water bath_PT2.67.xlsm
 * Method: TEM-002 (Liquid Bath)
 *
 * Run: npx tsx scripts/test-water-bath.ts
 */

import { calculateIsoUncertainty, type IsoCalcInput } from '../src/lib/isoUncertainty'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'
import {
  readings_44_5, readings_95,
  uucReadings_44_5, uucReadings_95,
  verticalReadings_44_5, verticalReadings_95,
} from './water-bath-test-data'

const SQRT3 = Math.sqrt(3)

// Get TEM-002 template
const template = ISO_METHOD_SEEDS.find(s => s.code === 'TEM-002')!

// Polynomial residuals from module W_TEM_006/1 (serial 44000189)
// Zero coefficients since readings are already corrected in Excel
const probeCorrections = [
  { probeId: 'P1', moduleId: '44000189', coefficients: { a: 0, b: 0, c: 0, d: 0 }, residual: 0.01314 },
  { probeId: 'P2', moduleId: '44000189', coefficients: { a: 0, b: 0, c: 0, d: 0 }, residual: 0.01830 },
  { probeId: 'P3', moduleId: '44000189', coefficients: { a: 0, b: 0, c: 0, d: 0 }, residual: 0.01232 },
  { probeId: 'P4', moduleId: '44000189', coefficients: { a: 0, b: 0, c: 0, d: 0 }, residual: 0.02910 },
  { probeId: 'P5', moduleId: '44000189', coefficients: { a: 0, b: 0, c: 0, d: 0 }, residual: 0.01030 },
]

console.log(`44.5°C readings: ${readings_44_5.length} rows x ${readings_44_5[0].length} sensors`)
console.log(`95°C readings: ${readings_95.length} rows x ${readings_95[0].length} sensors`)

const input: IsoCalcInput = {
  methodTemplate: template as any,
  calPoints: [
    {
      point: 44.5,
      uucSetting: 44.5,
      sensorReadings: readings_44_5,
      uucReadings: uucReadings_44_5,
      verticalReadings: verticalReadings_44_5,
    },
    {
      point: 95,
      uucSetting: 95,
      sensorReadings: readings_95,
      uucReadings: uucReadings_95,
      verticalReadings: verticalReadings_95,
    },
  ],
  std1: {},
  uucResolution: 0.01,
  probeCorrections,
  methodFields: {},
}

// Expected results from Excel
const expected = [
  {
    point: 44.5,
    stability: 0.055320,
    uniformity: 0.083550,
    verticalUniformity: 0.017173,
    overallVariation: 0.129860,
    indicatingReading: 44.505,
    budget: {
      dTCal_Std:      { value: 0.05,     ui: 0.025000 },
      dT_Drift_Std:   { value: 0.15,     ui: 0.086603 },
      dT_Int:         { value: 0.02910,  ui: 0.016798 },
      dT_Res_Std:     { value: 0.005,    ui: 0.002887 },
      dT_Stem:        { value: 0,        ui: 0 },
      dT_TC_Std:      { value: 0,        ui: 0 },
      dT_Stab:        { value: 0.055320, ui: 0.031939 },
      dT_Vert:        { value: 0.017173, ui: 0.009915 },
      dT_Res_UUC:     { value: 0.005,    ui: 0.002887 },
      dT_Rep_UUC:     { value: 0.013834, ui: 0.013834 },
    },
    uc: 0.098659,
    kp: 2.000,
    expandedU: 0.197322,
    reportedU: 0.20,
  },
  {
    point: 95,
    stability: 0.070360,
    uniformity: 0.127070,
    verticalUniformity: 0.031477,
    overallVariation: 0.194340,
    indicatingReading: 95.000,
    budget: {
      dTCal_Std:      { value: 0.05,     ui: 0.025000 },
      dT_Drift_Std:   { value: 0.15,     ui: 0.086603 },
      dT_Int:         { value: 0.02910,  ui: 0.016798 },
      dT_Res_Std:     { value: 0.005,    ui: 0.002887 },
      dT_Stem:        { value: 0,        ui: 0 },
      dT_TC_Std:      { value: 0,        ui: 0 },
      dT_Stab:        { value: 0.070360, ui: 0.040622 },
      dT_Vert:        { value: 0.031477, ui: 0.018173 },
      dT_Res_UUC:     { value: 0.005,    ui: 0.002887 },
      dT_Rep_UUC:     { value: 0.036008, ui: 0.036008 },
    },
    uc: 0.108170,
    kp: 2.001,
    expandedU: 0.216456,
    reportedU: 0.22,
  },
]

// Run calculation
const result = calculateIsoUncertainty(input)
if (!result) {
  console.error('ERROR: calculateIsoUncertainty returned null')
  process.exit(1)
}

console.log('\n=== Water Bath (TEM-002) Verification Test ===\n')

let allPass = true

for (let i = 0; i < expected.length; i++) {
  const exp = expected[i]
  const got = result.calPointResults[i]

  console.log(`--- Cal Point: ${exp.point}°C ---`)

  const check = (label: string, actual: number, expected: number, tolerance = 0.0005) => {
    const diff = Math.abs(actual - expected)
    const pass = diff <= tolerance
    const mark = pass ? 'PASS' : 'FAIL'
    const msg = `  [${mark}] ${label}: got=${actual.toFixed(6)}, exp=${expected.toFixed(6)}, diff=${diff.toFixed(8)}`
    console.log(msg)
    if (!pass) allPass = false
    return pass
  }

  check('Stability', got.stability, exp.stability)
  check('Uniformity', got.uniformity, exp.uniformity, 0.001)
  check('Vert. Uniformity', got.verticalUniformity ?? 0, exp.verticalUniformity)
  check('Overall Variation', got.overallVariation, exp.overallVariation, 0.002)
  check('Indicating Reading', got.indicatingReading ?? 0, exp.indicatingReading, 0.001)

  console.log('  Uncertainty Budget:')
  for (const [key, expBudget] of Object.entries(exp.budget)) {
    const gotSource = got.uncertaintyBudget.find(s => s.key === key)
    if (!gotSource) {
      console.log(`  [FAIL] ${key}: NOT FOUND`)
      allPass = false
      continue
    }
    check(`  ${key} value`, gotSource.value, expBudget.value)
    check(`  ${key} ui`, gotSource.ui, expBudget.ui)
  }

  check('uc', got.uc, exp.uc)
  check('kp', got.kp, exp.kp, 0.01)
  check('Expanded U', got.expandedU, exp.expandedU, 0.001)
  check('Reported U', got.reportedU, exp.reportedU)
  console.log()
}

const derivedVerticalResult = calculateIsoUncertainty({
  ...input,
  calPoints: [{
    ...input.calPoints[1],
    sensorReadings: [
      [94, 95, 93, 96, 95],
      [95, 96, 94, 97, 96],
    ],
    verticalReadings: undefined,
  }],
})

const derivedVertical = derivedVerticalResult?.calPointResults[0]?.verticalUniformity
if (derivedVertical !== 2) {
  console.log(`  [FAIL] Derived vertical uniformity: got=${derivedVertical}, exp=2`)
  allPass = false
} else {
  console.log('  [PASS] Derived vertical uniformity: got=2.000000, exp=2.000000')
}

console.log(allPass ? '=== ALL TESTS PASSED ===' : '=== SOME TESTS FAILED ===')
process.exit(allPass ? 0 : 1)
