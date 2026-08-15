/**
 * Compare TEM-003-2 DTM Onsite Excel formulas vs web ISO engine.
 * Run: node -r sucrase/register scripts/test-dtm-onsite.ts
 */
import { calculateIsoUncertainty, type IsoCalcInput } from '../src/lib/isoUncertainty'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'

const SQRT3 = Math.sqrt(3)

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }
function stdev(xs: number[]) {
  const m = avg(xs)
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1))
}
function excelRoundUp(value: number, digits: number) {
  const factor = 10 ** digits
  const scaled = value * factor
  const nearest = Math.round(scaled)
  if (Math.abs(scaled - nearest) < 1e-8) return nearest / factor
  return Math.ceil(scaled - 1e-10) / factor
}

const std = [37.001, 37.002, 37.000, 37.001, 37.002]
const uuc = [37.01, 37.00, 37.01, 37.02, 37.01]
const refStd = [0.002, 0.001, 0.000, 0.001, 0.002]
const refUuc = [0.00, 0.01, 0.00, 0.00, 0.01]
const point = 37
const uucRes = 0.01

const excelStdMean = avg(std)
const excelUucMean = avg(uuc)
const excelCorr = excelStdMean - excelUucMean
const excelRepStd = stdev(std)
const excelRepUuc = stdev(uuc)
const excelSts = Math.abs((excelStdMean - excelUucMean) - (avg(refStd) - avg(refUuc)))
const excelUi = [
  0.03 / 2,
  0.02 / SQRT3,
  0.001 / SQRT3,
  0.0005 / SQRT3,
  0.01 / SQRT3,
  0.01 / SQRT3,
  (uucRes / 2) / SQRT3,
  excelSts / SQRT3,
  0,
  excelRepStd,
  excelRepUuc,
]
const excelUc = Math.sqrt(excelUi.reduce((s, u) => s + u * u, 0))
const excelCmc = 0.05

const template = ISO_METHOD_SEEDS.find(s => s.code === 'TEM-003-2')!
const input: IsoCalcInput = {
  methodTemplate: template as any,
  calPoints: [{
    point,
    sensorReadings: uuc.map(v => [v]),
    stdReadings: std.map(v => [v]),
  }],
  calRefPoints: [{
    point: 0,
    sensorReadings: refUuc.map(v => [v]),
    stdReadings: refStd.map(v => [v]),
  }],
  std1: {},
  uucResolution: uucRes,
}

const result = calculateIsoUncertainty(input)
const got = result?.calPointResults[0]
const excelReported = (got?.expandedU ?? 0) < excelCmc
  ? excelCmc
  : excelRoundUp(got!.expandedU, 3)

let fails = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) fails++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`)
}

console.log('=== TEM-003-2 DTM Onsite: Excel formulas vs web engine ===\n')
console.log('Set point', point, '°C | 5 STD + 5 UUC | res', uucRes)
console.log()

check('stdMean', Math.abs((got?.stdMean ?? NaN) - excelStdMean) < 1e-9, `${got?.stdMean} vs ${excelStdMean}`)
check('indicatingReading AVERAGE (no CEILING)', Math.abs((got?.indicatingReading ?? NaN) - excelUucMean) < 1e-9, `${got?.indicatingReading} vs ${excelUucMean}`)
check('correction STD − UUC mean', Math.abs((got?.correction ?? NaN) - excelCorr) < 1e-9, `${got?.correction} vs ${excelCorr}`)

const rows = [
  ['dTSp 0.03/2', 0.03, 0.03 / 2, 'dTSp'],
  ['dT Drift 0.02', 0.02, 0.02 / SQRT3, 'dT_Drift_Std'],
  ['dTInt 0.001', 0.001, 0.001 / SQRT3, 'dTInt'],
  ['dT Res_Std 0.001/2', 0.0005, 0.0005 / SQRT3, 'dT_Res_Std'],
  ['dT Uni bath 0.01', 0.01, 0.01 / SQRT3, 'dT_Uni'],
  ['dT Sta bath 0.01', 0.01, 0.01 / SQRT3, 'dT_Sta'],
  ['dT Res_UUC /2', uucRes / 2, (uucRes / 2) / SQRT3, 'dT_Res_UUC'],
  ['dT STS ice-point', excelSts, excelSts / SQRT3, 'dT_STS'],
  ['dT Stem', 0, 0, 'dT_Stem'],
  ['dT Rep_Std STDEV', excelRepStd, excelRepStd, 'dT_Rep_Std'],
  ['dT Rep_UUC STDEV', excelRepUuc, excelRepUuc, 'dT_Rep_UUC'],
] as const

console.log('\nSource                     Excel value    Excel ui      Web value     Web ui')
for (const [label, ev, eui, key] of rows) {
  const src = got?.uncertaintyBudget.find(s => s.key === key)
  const wv = src?.value ?? NaN
  const wui = src?.ui ?? NaN
  const ok = Math.abs((wui || 0) - eui) < 0.0005
  check(`${label.padEnd(24)} ${ev.toFixed(6).padStart(12)} ${eui.toFixed(6).padStart(12)} ${Number(wv).toFixed(6).padStart(12)} ${Number(wui).toFixed(6).padStart(12)}`, ok)
}

check('no SPRT ohm×10 sources', !got?.uncertaintyBudget.some(s => s.key === 'dTIn' || s.key === 'dT_Sp_DS' || s.key === 'dT_Self_Heat'))
check('uc', Math.abs((got?.uc ?? NaN) - excelUc) < 0.0005, `Excel ${excelUc.toFixed(6)} | Web ${got?.uc?.toFixed(6)}`)
check('CMC = 0.05', got?.cmc === 0.05, `Web ${got?.cmc}`)
check('reportedU CMC / CEILING 0.001', Math.abs((got?.reportedU ?? NaN) - excelReported) < 0.0005,
  `Excel-style ${excelReported} | Web ${got?.reportedU} (U=${got?.expandedU?.toFixed(6)})`)
check('Rep STD veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_Std')?.vi === 9)
check('Rep UUC veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_UUC')?.vi === 9)

const cmcNeg = calculateIsoUncertainty({
  ...input,
  calPoints: [{ ...input.calPoints[0], point: -10 }],
})?.calPointResults[0]?.cmc
check('CMC below 0°C is still 0.05', cmcNeg === 0.05, `Web ${cmcNeg}`)

console.log('\nWeb kp', got?.kp, 'expandedU', got?.expandedU, 'reportedU', got?.reportedU)
if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll TEM-003-2 checks passed.')
