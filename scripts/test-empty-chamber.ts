/**
 * Compare TEM-001-1 Empty Chamber Excel formulas vs web ISO engine.
 * Run: node -r sucrase/register scripts/test-empty-chamber.ts
 */
import { calculateIsoUncertainty, type IsoCalcInput } from '../src/lib/isoUncertainty'
import { ISO_METHOD_SEEDS } from '../src/lib/isoMethodSeeds'

const SQRT3 = Math.sqrt(3)

function avg(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }
function stdev(xs: number[]) {
  const m = avg(xs)
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1))
}

// 9 sensors x 30 readings, #9 is center. Mild spatial/time variation.
function makeGrid() {
  const n = 30
  const sensors = 9
  const grid: number[][] = []
  const uuc: number[] = []
  for (let t = 0; t < n; t++) {
    const row: number[] = []
    for (let s = 0; s < sensors; s++) {
      const timeWobble = ((t % 5) - 2) * 0.01
      const spatial = (s === 8 ? 0 : (s - 4) * 0.02)
      row.push(37 + spatial + timeWobble)
    }
    grid.push(row)
    uuc.push(37.05 + ((t % 3) - 1) * 0.01)
  }
  return { grid, uuc }
}

function excelStability(grid: number[][]) {
  const sensors = grid[0].length
  let maxStab = 0
  for (let s = 0; s < sensors; s++) {
    const vals = grid.map(r => r[s])
    maxStab = Math.max(maxStab, (Math.max(...vals) - Math.min(...vals)) / 2)
  }
  return maxStab
}

function excelUniformity(grid: number[][], centerIdx = 8) {
  let maxDev = 0
  for (const row of grid) {
    const c = row[centerIdx]
    for (let i = 0; i < row.length; i++) {
      if (i === centerIdx) continue
      maxDev = Math.max(maxDev, Math.abs(c - row[i]))
    }
  }
  return maxDev
}

const { grid, uuc } = makeGrid()
const point = 37
const uucRes = 0.1
const residual = 0.02
const excelStab = excelStability(grid)
const excelUni = excelUniformity(grid)
const excelLoad = excelUni * 0.2
const excelRad = 0.0598 * 0.2
const excelRep = stdev(uuc)
const excelResUuc = uucRes / 2
const excelTc = 0
const excelUi = [
  0.05 / 2,
  0.15 / SQRT3,
  residual / SQRT3,
  0.005 / SQRT3,
  0.05 / SQRT3,
  excelTc / SQRT3,
  excelStab / SQRT3,
  excelLoad / SQRT3,
  excelRad / SQRT3,
  excelResUuc / SQRT3,
  excelRep,
]
const excelUc = Math.sqrt(excelUi.reduce((s, u) => s + u * u, 0))
const excelCmc = point < 0 ? 0.22 : point > 40 ? 1 : 0.29

const template = ISO_METHOD_SEEDS.find(s => s.code === 'TEM-001-1')!
const input: IsoCalcInput = {
  methodTemplate: template as any,
  calPoints: [{
    point,
    sensorReadings: grid,
    uucReadings: uuc,
  }],
  std1: {},
  uucResolution: uucRes,
  probeCorrections: Array.from({ length: 9 }, (_, i) => ({
    probeId: String(i + 1),
    moduleId: '',
    coefficients: { a: 0, b: 0, c: 0, d: 0 },
    residual,
  })),
}

const result = calculateIsoUncertainty(input)
const got = result?.calPointResults[0]

function excelRoundUp(value: number, digits: number) {
  const factor = 10 ** digits
  const scaled = value * factor
  const nearest = Math.round(scaled)
  if (Math.abs(scaled - nearest) < 1e-8) return nearest / factor
  return Math.ceil(scaled - 1e-10) / factor
}
const excelReported = (got?.expandedU ?? 0) < excelCmc
  ? excelCmc
  : ((got?.expandedU ?? 0) > 1 ? excelRoundUp(got!.expandedU, 1) : excelRoundUp(got!.expandedU, 2))

let fails = 0
function check(label: string, ok: boolean, detail = '') {
  if (!ok) fails++
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? '  ' + detail : ''}`)
}

console.log('=== TEM-001-1 Empty Chamber: Excel formulas vs web engine ===\n')
console.log('Set point', point, '°C | 9 sensors x 30 | UUC res', uucRes)
console.log()

check('stability (MAX-MIN)/2', Math.abs((got?.stability ?? NaN) - excelStab) < 1e-9, `${got?.stability} vs ${excelStab}`)
check('uniformity |S9-other|', Math.abs((got?.uniformity ?? NaN) - excelUni) < 1e-9, `${got?.uniformity} vs ${excelUni}`)
check('indicatingReading = AVERAGE(UUC)', Math.abs((got?.indicatingReading ?? NaN) - avg(uuc)) < 1e-9)

const rows = [
  ['dTCal_Std', 0.05, 0.05 / 2, 'dTCal_Std'],
  ['dT Drift', 0.15, 0.15 / SQRT3, 'dT_Drift_Std'],
  ['dT Int residual', residual, residual / SQRT3, 'dT_Int'],
  ['dT Res_Std 0.01/2', 0.005, 0.005 / SQRT3, 'dT_Res_Std'],
  ['dT Self_Heat', 0.05, 0.05 / SQRT3, 'dT_Self_Heat'],
  ['dT T.C.', excelTc, excelTc / SQRT3, 'dT_TC_Std'],
  ['dT Stab', excelStab, excelStab / SQRT3, 'dT_Stab'],
  ['dT Load = uni*0.2', excelLoad, excelLoad / SQRT3, 'dT_Load'],
  ['dT Rad 0.0598*0.2', excelRad, excelRad / SQRT3, 'dT_Rad'],
  ['dT Res_UUC /2', excelResUuc, excelResUuc / SQRT3, 'dT_Res_UUC'],
  ['dT Rep_UUC STDEV', excelRep, excelRep, 'dT_Rep_UUC'],
] as const

console.log('\nSource                     Excel value    Excel ui      Web value     Web ui')
for (const [label, ev, eui, key] of rows) {
  const src = got?.uncertaintyBudget.find(s => s.key === key)
  const wv = src?.value ?? NaN
  const wui = src?.ui ?? NaN
  const ok = Math.abs((wui || 0) - eui) < 0.0005
  check(`${label.padEnd(24)} ${ev.toFixed(6).padStart(12)} ${eui.toFixed(6).padStart(12)} ${Number(wv).toFixed(6).padStart(12)} ${Number(wui).toFixed(6).padStart(12)}`, ok)
}

const hasUniLine = got?.uncertaintyBudget.some(s => s.key === 'dT_Uni')
check('no dT_Uni line (empty chamber)', !hasUniLine)

check('uc', Math.abs((got?.uc ?? NaN) - excelUc) < 0.0005, `Excel ${excelUc.toFixed(6)} | Web ${got?.uc?.toFixed(6)}`)
check('CMC at 37°C = 0.29', got?.cmc === 0.29, `Web ${got?.cmc}`)
check('reportedU CMC floor / ROUNDUP', Math.abs((got?.reportedU ?? NaN) - excelReported) < 0.0005,
  `Excel-style ${excelReported} | Web ${got?.reportedU} (U=${got?.expandedU?.toFixed(4)})`)

const cmc40input: IsoCalcInput = { ...input, calPoints: [{ point: 40, sensorReadings: grid, uucReadings: uuc }] }
const cmc40 = calculateIsoUncertainty(cmc40input)?.calPointResults[0]?.cmc
check('CMC at exactly 40°C is 0.29 (Excel: NOT >40)', cmc40 === 0.29, `Web ${cmc40}`)

console.log('\nWeb kp', got?.kp, 'expandedU', got?.expandedU, 'reportedU', got?.reportedU)
if (fails) {
  console.error(`\n${fails} check(s) failed`)
  process.exit(1)
}
console.log('\nAll TEM-001-1 checks passed.')
