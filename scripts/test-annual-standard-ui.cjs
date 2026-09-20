require('sucrase/register')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const { transform } = require('sucrase')

const filename = path.resolve(__dirname, '../src/components/StandardInstrumentYears.tsx')
const loaded = new Module(filename, module)
loaded.filename = filename
loaded.paths = Module._nodeModulePaths(path.dirname(filename))
loaded._compile(transform(fs.readFileSync(filename, 'utf8'), {
  transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic',
}).code, filename)
const { annualTablesFromDraft } = loaded.exports
const table = (overrides = {}) => ({ _id: 'stable-table', tableName: 'Temperature', points: '0, 25, 50', units: '°C', stdValues: '0.1, , 50.2', ...overrides })

test('keeps missing STD values aligned instead of shifting later readings', () => {
  const [result] = annualTablesFromDraft([table()], { measurement: 'Temperature' })
  assert.deepEqual(result.stdValues, [0.1, null, 50.2])
  assert.deepEqual(result.points.map(point => point.unit), ['°C', '°C', '°C'])
})
test('preserves time strings and per-point units', () => {
  const [result] = annualTablesFromDraft([table({ points: '01:00, 02:00', units: 'min, sec', stdValues: '00:59, 01:59' })], { measurement: 'Time' })
  assert.deepEqual(result.points, [{ pointValue: '01:00', unit: 'min' }, { pointValue: '02:00', unit: 'sec' }])
  assert.deepEqual(result.stdValues, ['00:59', '01:59'])
})
test('allows zero tables without adding a default table', () => {
  assert.deepEqual(annualTablesFromDraft([], {}), [])
})
test('retains stable table IDs and saves display order after reordering', () => {
  const result = annualTablesFromDraft([table({ _id: 'second' }), table({ _id: 'first' })], {})
  assert.deepEqual(result.map(table => [table._id, table.order]), [['second', 0], ['first', 1]])
})
test('rejects empty point positions and invalid numeric STD values', () => {
  assert.throws(() => annualTablesFromDraft([table({ points: '1,,3' })], {}), /ช่องว่าง/)
  assert.throws(() => annualTablesFromDraft([table({ stdValues: '1, invalid, 3' })], {}), /ตัวเลข/)
})
test('rejects extra STD readings and ambiguous per-point units', () => {
  assert.throws(() => annualTablesFromDraft([table({ stdValues: '1,2,3,4' })], {}), /มากกว่า/)
  assert.throws(() => annualTablesFromDraft([table({ units: '°C,°F' })], {}), /หนึ่งหน่วยต่อจุด/)
})

// Mount the real component with a small hook host to exercise its rendered controls.
// Network is injected; user handlers and update sequencing are production code.
function mountAnnual(fetcher) {
  const slots = [], effects = [], deps = []
  let cursor = 0, tree
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, values) {
      const index = cursor++
      if (!deps[index] || values.some((value, i) => !Object.is(value, deps[index][i]))) {
        deps[index] = values
        effects.push(effect)
      }
    },
  }
  const mocked = new Module(filename, module)
  mocked.filename = filename
  mocked.paths = loaded.paths
  mocked.require = name => name === '../lib/formulaDivisors' ? require('../src/lib/formulaDivisors.ts') : name === 'react' ? react : name === 'react-hot-toast' ? { success() {} } : require(name)
  mocked._compile(transform(fs.readFileSync(filename, 'utf8'), { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'automatic' }).code.replace('await fetch(url,', 'await globalThis.__annualTestFetch(url,'), filename)
  globalThis.__annualTestFetch = fetcher
  function render() {
    cursor = 0
    tree = mocked.exports.default({ instrument: { _id: 'instrument' }, onChanged() {} })
    while (effects.length) effects.shift()()
    return tree
  }
  function walk(node, predicate) {
    if (!node || typeof node !== 'object') return []
    if (Array.isArray(node)) return node.flatMap(child => walk(child, predicate))
    return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)]
  }
  function text(node) {
    if (node == null || typeof node === 'boolean') return ''
    if (Array.isArray(node)) return node.map(text).join('')
    return typeof node === 'object' ? text(node.props?.children) : String(node)
  }
  render()
  return {
    render, text: () => text(tree),
    find: predicate => walk(tree, predicate),
    button: label => walk(tree, node => node.type === 'button' && text(node).includes(label))[0],
    flush: async () => { await new Promise(resolve => setImmediate(resolve)); render() },
  }
}
const response = data => ({ ok: true, json: async () => data })
const sampleVersion = year => ({ _id: `version-${year}`, year, revision: 2, fields: { no: 'S1', name: 'Standard' }, calPoints: [] })

test('loading legacy data does not silently create a year, and initialization requires a year', async () => {
  const calls = []
  const ui = mountAnnual(async (url, init) => { calls.push([url, init]); return response({ data: [], legacy: { fields: { no: 'S1' }, calPoints: [], certificates: [{ year: 2568, fileName: 'old.pdf' }] } }) })
  await ui.flush()
  assert.match(ui.text(), /PDF เดิม/)
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].method, undefined)
  ui.button('เริ่มข้อมูลรายปีจากข้อมูลเดิม').props.onClick()
  ui.render()
  assert.equal(ui.find(node => node.props?.['aria-label'] === 'ปีของข้อมูลที่จะบันทึก')[0].props.value, '')
  await ui.button('ยืนยันปีและบันทึก').props.onClick()
  ui.render()
  assert.match(ui.text(), /กรุณาระบุปี/)
  assert.equal(calls.length, 1)
})

test('updates require explicit preview confirmation, run serially, report each result, and clear when year changes', async () => {
  const posts = []
  let releaseFirst, firstStarted, active = 0, maxActive = 0
  const started = new Promise(resolve => { firstStarted = resolve })
  const preview = { versionId: 'version-2026', history: [], items: [
    { recordId: 'first', status: 'ready', updatedAt: 'first-date', certNo: 'C1', changes: ['New STD'] },
    { recordId: 'second', status: 'ready', updatedAt: 'second-date', certNo: 'C2', changes: ['New STD'] },
    { recordId: 'manual', status: 'manual', certNo: 'C3', reason: 'Manual', changes: [] },
  ] }
  const ui = mountAnnual(async (url, init) => {
    if (!url.endsWith('/updates')) return response({ data: [sampleVersion(2026), sampleVersion(2025)], legacy: {} })
    if (init.method !== 'POST') return response(preview)
    const body = JSON.parse(init.body)
    posts.push(body)
    active++; maxActive = Math.max(maxActive, active)
    if (body.recordId === 'first') { firstStarted(); await new Promise(resolve => { releaseFirst = resolve }); active--; return response({ ok: true }) }
    active--
    return { ok: false, status: 409, json: async () => ({ error: 'Record changed' }) }
  })
  await ui.flush()
  assert.equal(ui.button('Check update'), undefined)
  assert.equal(ui.button('พ.ศ. 2569').props['aria-expanded'], false)
  assert.match(ui.button('พ.ศ. 2569').props.className, /bg-green-100/)
  ui.button('พ.ศ. 2569').props.onClick()
  ui.render()
  await ui.button('Check update').props.onClick()
  ui.render()
  assert.equal(posts.length, 0)
  const confirmation = ui.button('ยืนยันอัปเดตใบรับรองทั้งหมด')
  assert.ok(confirmation)
  const completed = confirmation.props.onClick()
  await started
  ui.render()
  assert.equal(ui.find(node => node.type === 'fieldset')[0].props.disabled, true)
  assert.equal(posts.length, 1)
  releaseFirst()
  await completed
  ui.render()
  assert.equal(maxActive, 1)
  assert.deepEqual(posts.map(post => post.recordId), ['first', 'second'])
  assert.equal(posts[0].versionId, 'version-2026')
  assert.equal(posts[0].expectedUpdatedAt, 'first-date')
  assert.match(ui.text(), /อัปเดตสำเร็จ/)
  assert.match(ui.text(), /Record changed/)
  assert.equal(ui.button('ยืนยันอัปเดตใบรับรองทั้งหมด').props.disabled, true)
  assert.ok(ui.button('ตรวจสอบอีกครั้ง'))
  ui.button('พ.ศ. 2568').props.onClick()
  ui.render()
  assert.equal(ui.button('ยืนยันอัปเดตใบรับรองทั้งหมด'), undefined)
  assert.doesNotMatch(ui.text(), /Record changed/)
  ui.button('พ.ศ. 2568').props.onClick()
  ui.render()
  assert.equal(ui.button('Check update'), undefined)
})

test('adding a year clears every coefficient and annual measurement value while retaining instrument identity', async () => {
  const version = sampleVersion(2026)
  version.fields = { ...version.fields, correctionModel: 'polynomial-v1', correctionA: 1, correctionB: 2, correctionC: 3, correctionD: 4, calDate: '2026-01-01', uTStd: 0.1, expandedU: 0.2 }
  const ui = mountAnnual(async () => response({ data: [version], legacy: {} }))
  await ui.flush()
  ui.button('+ เพิ่มปี').props.onClick(); ui.render()
  const labels = ui.find(n => n.type === 'label')
  for (const label of ['A (x³)', 'B (x²)', 'C (x)', 'D', 'วันที่สอบเทียบ', 'uTStd', 'expandedU']) {
    const node = labels.find(n => n.props.children?.[0] === label)
    assert.ok(node, label)
    assert.equal(node.props.children[1].props.value, '', label)
  }
  assert.equal(labels.find(n => n.props.children?.[0] === 'รหัส').props.children[1].props.value, 'S1')
})
