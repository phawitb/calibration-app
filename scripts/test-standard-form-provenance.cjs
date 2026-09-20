const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
function harness(initial, stdRefs = [], options = {}) {
  let cursor = 0, value = initial, updates = 0
  const slots = [], effects = [], cleanups = []
  const react = { ...require('react'),
    useRef: initial => slots[cursor++] ||= { current: initial },
    useState: initial => {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [slots[i], next => { slots[i] = next }]
    },
    useMemo: fn => fn(),
    useEffect: fn => { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn) } },
  }
  const source = ts.transpileModule(fs.readFileSync('src/components/CalibrationForm.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const exports = {}
  new Function('require', 'exports', source)(name => name === 'react' ? react : name === 'react/jsx-runtime' ? require(name) : {}, exports)
  const render = () => {
    cursor = 0
    const tree = exports.UcSection({ label: 'UC1', value, stdRefs, ...options, onChange: next => { value = next; updates++ } })
    while (effects.length) { const cleanup = effects.shift()(); if (cleanup) cleanups.push(cleanup) }
    return nodes(tree)
  }
  return { render, get value() { return value }, get updates() { return updates }, unmount: () => cleanups.forEach(fn => fn()) }
}
const choose = (h, no) => h.render().find(n => n.type === 'select' && n.props['aria-label']).props.onChange({ target: { value: no } })
const pointInputs = h => nodes(h.render().find(n => n.type === 'tbody')).filter(n => n.type === 'input')
const change = (input, value) => input.props.onChange({ target: { value } })
const flush = () => new Promise(resolve => setImmediate(resolve))
const ref = (no, version) => ({ _id: no, instrumentRefId: no, no, name: no, referenceYear: 2026, referenceRevision: 2, referenceVersionId: version, correction: 2, expandedU: 0.25 })

test('selection fetches exact version and stores table and original standards; edits preserve provenance', async () => {
  const originalFetch = global.fetch
  let requested
  global.fetch = async url => { requested = url; return { ok: true, json: async () => ({ data: [{ _id: 'table-a', points: [{ pointValue: 10 }], stdValues: [13] }] }) } }
  try {
    const h = harness({}, [ref('1021', 'version-a')])
    choose(h, '1021')
    await flush()
    assert.equal(new URL(requested, 'http://localhost').searchParams.get('versionId'), 'version-a')
    assert.equal(h.value.std.referenceVersionId, 'version-a')
    assert.equal(h.value.std.referenceYear, 2026)
    assert.equal(h.value.std.expandedU, 0.25)
    assert.equal(h.value.calibrationTableId, 'table-a')
    assert.deepEqual(h.value.calPoints[0].referenceStandards, [13, 13, 13, 13])
    change(pointInputs(h)[5], '17')
    assert.deepEqual(h.value.calPoints[0].standards, [17, 13, 13, 13])
    assert.deepEqual(h.value.calPoints[0].referenceStandards, [13, 13, 13, 13])
    change(pointInputs(h)[1], '11')
    assert.deepEqual(h.value.calPoints[0].readings, [11, '', '', ''])
    change(pointInputs(h)[0], '20')
    assert.deepEqual(h.value.calPoints[0].referenceStandards, [22, 22, 22, 22])
    assert.equal(h.value.calPoints[0].referencePoint, '20')
    assert.deepEqual(h.value.calPoints[0].readings, [11, '', '', ''])
  } finally { global.fetch = originalFetch }
})

test('saved versioned standards with sparse identity are not resolved against latest references', () => {
  const h = harness({ std: { no: '1021', referenceVersionId: 'old-version' } }, [ref('1021', 'new-version')])
  h.render()
  assert.equal(h.updates, 0)
  assert.equal(h.value.std.referenceVersionId, 'old-version')
})

test('late table responses cannot overwrite newer selections or an unmounted form', async () => {
  const originalFetch = global.fetch
  const pending = []
  global.fetch = () => new Promise(resolve => pending.push(resolve))
  const response = id => ({ ok: true, json: async () => ({ data: [{ _id: id, points: [{ pointValue: 10 }] }] }) })
  try {
    const h = harness({}, [ref('1021', 'v1'), ref('2022', 'v2')])
    choose(h, '1021'); choose(h, '2022')
    pending[1](response('new-table')); await flush()
    pending[0](response('old-table')); await flush()
    assert.equal(h.value.std.no, '2022')
    assert.equal(h.value.calibrationTableId, 'new-table')
    choose(h, '1021')
    const count = h.updates
    h.unmount()
    pending[2](response('unmounted')); await flush()
    assert.equal(h.updates, count)
  } finally { global.fetch = originalFetch }
})


test('historical sparse unversioned standards remain unchanged, while new drafts resolve defaults', () => {
  const refs = [{ no: '1021', name: 'Latest instrument', correction: 3 }]
  const initial = { std: { no: '1021' }, calPoints: [{ point: '10', standards: [11], readings: [9] }] }
  const historical = harness(initial, refs, { allowAutoResolve: false })
  historical.render()
  assert.equal(historical.updates, 0)
  assert.deepEqual(historical.value, initial)
  const draft = harness({ std: { no: '1021' } }, refs, { allowAutoResolve: true })
  draft.render()
  assert.equal(draft.updates, 1)
  assert.equal(draft.value.std.name, 'Latest instrument')
})
