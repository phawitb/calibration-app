/**
 * Compare TEM-003-1 DTM Permanent Excel formulas vs web ISO engine.
 * Run: node -r sucrase/register scripts/test-dtm-permanent.ts
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
function excelCeilingMath(value: number, significance: number) {
  return Math.ceil(value / significance - 1e-10) * significance
}

const std = [37.001, 37.002, 37.000, 37.001, 37.002]
const uuc = [37.01, 37.00, 37.01, 37.02, 37.01]
const refStd = [0.002, 0.001, 0.000, 0.001, 0.002]
const refUuc = [0.00, 0.01, 0.00, 0.00, 0.01]
const point = 37
const uucRes = 0.01

const excelStdMean = avg(std)
const excelUucMean = avg(uuc)
const excelIndicating = excelCeilingMath(excelUucMean, uucRes)
const excelCorr = excelStdMean - excelIndicating
const excelRepStd = stdev(std)
const excelRepUuc = stdev(uuc)
const excelSts = Math.abs((excelStdMean - excelUucMean) - (avg(refStd) - avg(refUuc)))
const excelUi = [
  0.003 / 2,
  0.0016 / SQRT3 * 10,
  0.001 / 2 * 10,
  0.001 / SQRT3 * 10,
  0.00005 / SQRT3,
  0.01 / SQRT3,
  0.01 / SQRT3,
  (uucRes / 2) / SQRT3,
  excelSts / SQRT3,
  0,
  excelRepStd,
  excelRepUuc,
]
const excelUc = Math.sqrt(excelUi.reduce((s, u) => s + u * u, 0))
const excelCmc = point < 0 ? 0.04 : 0.03

const template = ISO_METHOD_SEEDS.find(s => s.code === 'TEM-003-1')!
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

console.log('=== TEM-003-1 DTM Permanent: Excel formulas vs web engine ===\n')
console.log('Set point', point, '°C | 5 STD + 5 UUC | res', uucRes)
console.log()

check('stdMean', Math.abs((got?.stdMean ?? NaN) - excelStdMean) < 1e-9, `${got?.stdMean} vs ${excelStdMean}`)
check('indicatingReading CEILING.MATH', Math.abs((got?.indicatingReading ?? NaN) - excelIndicating) < 1e-9, `${got?.indicatingReading} vs ${excelIndicating}`)
check('correction STD − CEILING(UUC)', Math.abs((got?.correction ?? NaN) - excelCorr) < 1e-9, `${got?.correction} vs ${excelCorr}`)

const rows = [
  ['dTSp 0.003/2', 0.003, 0.003 / 2, 'dTSp'],
  ['dT Drift Ω×10', 0.0016, 0.0016 / SQRT3 * 10, 'dT_Drift_Std'],
  ['dTIn Ω×10 /2', 0.001, 0.001 / 2 * 10, 'dTIn'],
  ['dT Sp,DS Ω×10', 0.001, 0.001 / SQRT3 * 10, 'dT_Sp_DS'],
  ['dT Res_Std 0.0001/2', 0.00005, 0.00005 / SQRT3, 'dT_Res_Std'],
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

check('uc', Math.abs((got?.uc ?? NaN) - excelUc) < 0.0005, `Excel ${excelUc.toFixed(6)} | Web ${got?.uc?.toFixed(6)}`)
check('CMC at 37°C = 0.03', got?.cmc === 0.03, `Web ${got?.cmc}`)
check('reportedU CMC / ROUNDUP 3dp', Math.abs((got?.reportedU ?? NaN) - excelReported) < 0.0005,
  `Excel-style ${excelReported} | Web ${got?.reportedU} (U=${got?.expandedU?.toFixed(6)})`)
check('Rep STD veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_Std')?.vi === 9)
check('Rep UUC veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_UUC')?.vi === 9)

const cmcNeg = calculateIsoUncertainty({
  ...input,
  calPoints: [{ ...input.calPoints[0], point: -10 }],
})?.calPointResults[0]?.cmc
check('CMC below 0°C is 0.04', cmcNeg === 0.04, `Web ${cmcNeg}`)

console.log('\nWeb kp', got?.kp, 'expandedU', got?.expandedU, 'reportedU', got?.reportedU)
if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll TEM-003-1 checks passed.')
