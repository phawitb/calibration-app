/**
 * Compare TEM-003-3 Type K Excel formulas vs web ISO engine.
 * Run: node -r sucrase/register scripts/test-type-k.ts
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
const irjStd1 = 25.00
const irjUuc1 = 25.10
const irjStd2 = 25.01
const irjUuc2 = 25.05
const excelIrj = Math.abs((irjUuc1 - irjStd1) - (irjUuc2 - irjStd2))
const excelInh = 0.1

const excelStdMean = avg(std)
const excelUucMean = avg(uuc)
const excelCorr = excelStdMean - excelUucMean
const excelRepStd = stdev(std)
const excelRepUuc = stdev(uuc)
const excelSts = Math.abs((excelStdMean - excelUucMean) - (avg(refStd) - avg(refUuc)))
const excelUi = [
  0.003 / 2,
  0.0016 / SQRT3 * 10,
  0.001 / 2 * 10,
  0.001 / SQRT3 * 10,
  0.0000005 / SQRT3,
  0.01 / SQRT3,
  0.01 / SQRT3,
  (uucRes / 2) / SQRT3,
  excelSts / SQRT3,
  0,
  excelIrj / SQRT3,
  excelInh / SQRT3,
  excelRepStd,
  excelRepUuc,
]
const excelUc = Math.sqrt(excelUi.reduce((s, u) => s + u * u, 0))
const excelCmc = point > 50 ? 0.5 : 0.4

const template = ISO_METHOD_SEEDS.find(s => s.code === 'TEM-003-3')!
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
  methodFields: {
    wireCondition: 'New (สายใหม่)',
    irjStd1, irjUuc1, irjStd2, irjUuc2,
  },
}

const result = calculateIsoUncertainty(input)
const got = result?.calPointResults[0]
const excelReported = (got?.expandedU ?? 0) < excelCmc
  ? excelCmc
  : excelRoundUp(got!.expandedU, 2)

let fails = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) fails++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`)
}

console.log('=== TEM-003-3 Type K: Excel formulas vs web engine ===\n')
console.log('Set point', point, '°C | 5 STD + 5 UUC | res', uucRes, '| new wire | IRJ', excelIrj)
console.log()

check('stdMean', Math.abs((got?.stdMean ?? NaN) - excelStdMean) < 1e-9, `${got?.stdMean} vs ${excelStdMean}`)
check('indicatingReading AVERAGE (no CEILING)', Math.abs((got?.indicatingReading ?? NaN) - excelUucMean) < 1e-9, `${got?.indicatingReading} vs ${excelUucMean}`)
check('correction STD − UUC mean', Math.abs((got?.correction ?? NaN) - excelCorr) < 1e-9, `${got?.correction} vs ${excelCorr}`)

const rows = [
  ['dTSp 0.003/2', 0.003, 0.003 / 2, 'dTSp'],
  ['dT Drift Ω×10', 0.0016, 0.0016 / SQRT3 * 10, 'dT_Drift_Std'],
  ['dTIn Ω×10 /2', 0.001, 0.001 / 2 * 10, 'dTIn'],
  ['dT Sp,DS Ω×10', 0.001, 0.001 / SQRT3 * 10, 'dT_Sp_DS'],
  ['dT Res_Std 1e-6/2', 0.0000005, 0.0000005 / SQRT3, 'dT_Res_Std'],
  ['dT Uni bath 0.01', 0.01, 0.01 / SQRT3, 'dT_Uni'],
  ['dT Sta bath 0.01', 0.01, 0.01 / SQRT3, 'dT_Sta'],
  ['dT Res_UUC /2', uucRes / 2, (uucRes / 2) / SQRT3, 'dT_Res_UUC'],
  ['dT STS ice-point', excelSts, excelSts / SQRT3, 'dT_STS'],
  ['dT Stem', 0, 0, 'dT_Stem'],
  ['dT IRJ ambient', excelIrj, excelIrj / SQRT3, 'dT_IRJ'],
  ['dT Inh new 0.1', excelInh, excelInh / SQRT3, 'dT_Inh'],
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
check('CMC at 37°C = 0.4', got?.cmc === 0.4, `Web ${got?.cmc}`)
check('reportedU CMC / ROUNDUP 2dp', Math.abs((got?.reportedU ?? NaN) - excelReported) < 0.0005,
  `Excel-style ${excelReported} | Web ${got?.reportedU} (U=${got?.expandedU?.toFixed(6)})`)
check('Rep STD veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_Std')?.vi === 9)
check('Rep UUC veff=9', got?.uncertaintyBudget.find(s => s.key === 'dT_Rep_UUC')?.vi === 9)

const cmc50 = calculateIsoUncertainty({
  ...input,
  calPoints: [{ ...input.calPoints[0], point: 50 }],
})?.calPointResults[0]?.cmc
check('CMC at 50°C is 0.4 (Excel: NOT >50)', cmc50 === 0.4, `Web ${cmc50}`)

const cmc51 = calculateIsoUncertainty({
  ...input,
  calPoints: [{ ...input.calPoints[0], point: 51 }],
})?.calPointResults[0]?.cmc
check('CMC above 50°C is 0.5', cmc51 === 0.5, `Web ${cmc51}`)

const usedInh = calculateIsoUncertainty({
  ...input,
  methodFields: { ...input.methodFields, wireCondition: 'Used (สายเก่า)' },
})?.calPointResults[0]?.uncertaintyBudget.find(s => s.key === 'dT_Inh')?.value
check('used wire Inh = 0.44', usedInh === 0.44, `Web ${usedInh}`)

const emptyInh = calculateIsoUncertainty({
  ...input,
  methodFields: { irjStd1, irjUuc1, irjStd2, irjUuc2 },
})?.calPointResults[0]?.uncertaintyBudget.find(s => s.key === 'dT_Inh')?.value
check('empty wire Inh = 0.44 (Excel AB4 blank)', emptyInh === 0.44, `Web ${emptyInh}`)

console.log('\nWeb kp', got?.kp, 'expandedU', got?.expandedU, 'reportedU', got?.reportedU)
if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll TEM-003-3 checks passed.')
