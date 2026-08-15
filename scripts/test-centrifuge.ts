/**
 * Compare ELC-001 centrifuge Excel formulas vs web ISO engine.
 * Run: npx tsx scripts/test-centrifuge.ts
 *      node -r sucrase/register scripts/test-centrifuge.ts
 */
import { calculateIsoUncertainty, type IsoCalcInput } from '../src/lib/isoUncertainty'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'

const SQRT3 = Math.sqrt(3)
const SQRT6 = Math.sqrt(6)

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }
function stdev(xs: number[]) {
  const m = avg(xs)
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1))
}
function excelRoundUp(value: number, digits: number): number {
  const factor = 10 ** digits
  const scaled = value * factor
  const nearest = Math.round(scaled)
  if (Math.abs(scaled - nearest) < 1e-8) return nearest / factor
  return Math.ceil(scaled - 1e-10) / factor
}

const uuc = [1000, 1001, 999, 1000]
const std = [1002, 1003, 1001, 1002]
const uucRes = 1
const n = 4
const stdCorr = 0

const excelStdMean = avg(std.map(v => v + stdCorr))
const excelUucMean = avg(uuc)
const excelCorr = excelStdMean - excelUucMean
const excelRepStd = stdev(std.map(v => v + stdCorr)) / Math.sqrt(n)
const excelRepUuc = stdev(uuc) / Math.sqrt(n)
const excelCal = excelStdMean < 1000 ? 0.12 : 1.2
const excelDrift = excelCal
const excelResStd = excelStdMean > 999 ? 1 : 0.1
const excelResUuc = uucRes
const excelInt = 0
const excelUi = [
  excelCal / 2,
  excelDrift / SQRT6,
  excelResStd / SQRT3,
  excelResUuc / SQRT3,
  excelInt / SQRT3,
  excelRepStd,
  excelRepUuc,
]
const excelUc = Math.sqrt(excelUi.reduce((s, u) => s + u * u, 0))
const excelCmc = excelUucMean < 1000 ? 1.2 : excelUucMean > 5000 ? 2.5 : 2.4

const template = ISO_METHOD_SEEDS.find(s => s.code === 'ELC-001')!
const input: IsoCalcInput = {
  methodTemplate: template as any,
  calPoints: [{
    point: 1000,
    sensorReadings: uuc.map(v => [v]),
    stdReadings: std.map(v => [v]),
    standardCorrection: stdCorr,
  }],
  std1: {
    uTStd: 99,
    uTDrif: 99,
    uTResStd: 99,
    uTInt: excelInt,
  },
  uucResolution: uucRes,
  timeCheck: { uucTime: [10, 10.2, 9.8, 10, 10], stdTime: [10.1, 10, 9.9, 10, 10.2] },
}

const result = calculateIsoUncertainty(input)
const got = result?.calPointResults[0]
const excelReported = (got?.expandedU ?? 0) < excelCmc
  ? excelRoundUp(excelCmc, 2)
  : excelRoundUp(got?.expandedU ?? 0, 1)

let fails = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) fails++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`)
}

console.log('=== ELC-001 Centrifuge: Excel formulas vs web engine ===\n')
console.log('Example: UUC', uuc.join(', '), '| STD', std.join(', '), '| resolution', uucRes)
console.log()
console.log('Excel means: STD', excelStdMean.toFixed(3), 'UUC', excelUucMean.toFixed(3), 'correction', excelCorr.toFixed(3))
console.log('Web  means: UUC', got?.indicatingReading?.toFixed(3),
  'stdMean', got?.stdMean?.toFixed(3),
  'correction', got?.correction?.toFixed(3))
console.log()

check('correction', Math.abs((got?.correction ?? NaN) - excelCorr) < 0.0005, `${got?.correction} vs ${excelCorr}`)
check('stdMean', Math.abs((got?.stdMean ?? NaN) - excelStdMean) < 0.0005, `${got?.stdMean} vs ${excelStdMean}`)
check('Cal/Drift ignore std1 certificate fields', (got?.uncertaintyBudget.find(s => s.key === 'dTCal_Std')?.value ?? NaN) === excelCal)

const rows = [
  ['dTCal_Std', excelCal, excelCal / 2, 'dTCal_Std'],
  ['dT Drift (√6)', excelDrift, excelDrift / SQRT6, 'dT_Drift_Std'],
  ['dT Res_Std', excelResStd, excelResStd / SQRT3, 'dT_Res_Std'],
  ['dT Res_UUC', excelResUuc, excelResUuc / SQRT3, 'dT_Res_UUC'],
  ['dT Int', excelInt, excelInt / SQRT3, 'dT_Int'],
  ['dT Rep_STD', excelRepStd, excelRepStd, 'dT_Rep_Std'],
  ['dT Rep_UUC', excelRepUuc, excelRepUuc, 'dT_Rep_UUC'],
] as const

console.log()
console.log('Source                  Excel value    Excel ui      Web value     Web ui')
for (const [label, ev, eui, key] of rows) {
  const src = got?.uncertaintyBudget.find(s => s.key === key)
  const wv = src?.value ?? NaN
  const wui = src?.ui ?? NaN
  const ok = Math.abs((wui || 0) - eui) < 0.0005
  check(`${label.padEnd(22)} ${ev.toFixed(6).padStart(12)} ${eui.toFixed(6).padStart(12)} ${wv.toFixed(6).padStart(12)} ${wui.toFixed(6).padStart(12)}`, ok)
}

check('uc', Math.abs((got?.uc ?? NaN) - excelUc) < 0.0005, `Excel ${excelUc.toFixed(6)} | Web ${got?.uc.toFixed(6)}`)
check('CMC from UUC mean', got?.cmc === excelCmc, `Excel ${excelCmc} | Web ${got?.cmc}`)
check('reportedU CMC floor / ROUNDUP', Math.abs((got?.reportedU ?? NaN) - excelReported) < 0.0005,
  `expected ${excelReported} | Web ${got?.reportedU} (U=${got?.expandedU?.toFixed(4)})`)
check('timeCheckResult', Boolean(result?.timeCheckResult),
  `Δt=${result?.timeCheckResult?.timeDifference?.toFixed(3)} s`)

console.log()
console.log('Web kp', got?.kp, 'expandedU', got?.expandedU, 'reportedU', got?.reportedU)

if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll ELC-001 checks passed.')
