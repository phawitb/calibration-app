const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const helpers = require('../src/lib/amedUcOptions')

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => {
    assert.ok(name in mocks, `Unexpected dependency: ${name}`)
    return mocks[name]
  }, exports)
  return exports
}

function routes(writeError) {
  const writes = []
  const model = {
    create: async data => { if (writeError) throw writeError; writes.push(data); return data },
    findByIdAndUpdate: (id, update) => {
      if (writeError) throw writeError
      writes.push(update.$set)
      return { lean: () => ({ exec: async () => update.$set }) }
    },
  }
  const mocks = {
    '@/models/AmedDevice': model,
    '@/lib/workOrderService': {},
    '@/lib/workOrderHttp': { orderFailure: error => { throw error } },
    '@/lib/unitVariants': {},
    '@/lib/amedUcOptions': helpers,
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { role: 'admin' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/mongodb': { connectDB: async () => {} },
    mongoose: require('mongoose'),
  }
  return {
    writes,
    single: load('src/app/api/admin/reference/route.ts', mocks),
    devices: load('src/app/api/ameddevices/route.ts', mocks),
    bulk: load('src/app/api/admin/reference/bulk/route.ts', mocks),
  }
}
const request = data => ({ json: async () => data })

test('registry create and update preserve ordered UC arrays and clearing a list', async () => {
  const { writes, single } = routes()
  const uc = Object.fromEntries(helpers.AMED_UC_KEYS.map(key => [key, [1021, '2022']]))
  assert.equal((await single.POST(request({ type: 'ameddevices', amedNo: 'A', unitName: 'B', ...uc }))).status, 201)
  for (const key of helpers.AMED_UC_KEYS) assert.deepEqual(writes[0][key], ['1021', '2022'])
  assert.equal((await single.PUT(request({ type: 'ameddevices', _id: 'a'.repeat(24), uc1: ['2022', '1021'], ucT: [] }))).status, 200)
  assert.deepEqual(writes[1], { uc1: ['2022', '1021'], ucT: [] })
})

test('device creation endpoint also stores UC lists and rejects invalid input before writing', async () => {
  const { writes, devices } = routes()
  assert.equal((await devices.POST(request({ amedNo: 'A', unitName: 'B', uc1: [1021, 2022], ucT: '0012' }))).status, 201)
  assert.deepEqual(writes[0].uc1, ['1021', '2022'])
  assert.deepEqual(writes[0].ucT, ['0012'])
  assert.deepEqual(writes[0].uc6, [])
  assert.equal((await devices.POST(request({ amedNo: 'A', unitName: 'B', uc1: {} }))).status, 400)
  assert.equal(writes.length, 1)
})

test('CSV import accepts JSON lists and legacy codes; invalid batch does not write anything', async () => {
  const { writes, bulk } = routes()
  const rows = [{ amedNo: 'A', unitName: 'B', uc1: '[1021,2022]', ucT: '0012' }]
  assert.equal((await bulk.POST(request({ type: 'ameddevices', rows }))).status, 200)
  assert.deepEqual(writes[0], { amedNo: 'A', unitName: 'B', uc1: ['1021', '2022'], ucT: ['0012'] })
  writes.length = 0
  assert.equal((await bulk.POST(request({ type: 'ameddevices', rows: [...rows, { uc1: '[invalid]' }] }))).status, 400)
  assert.equal(writes.length, 0)
})

function descendants(node) {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(descendants)
  return [node, ...descendants(node.props?.children)]
}

test('UC instrument dropdown uses registry choices and selecting a code fills its reference data', () => {
  const react = require('react')
  const { UcSection } = load('src/components/CalibrationForm.tsx', {
    react: { ...react, useEffect: () => {}, useRef: value => ({ current: value }),
      useMemo: fn => fn(), useState: value => [typeof value === 'function' ? value() : value, () => {}] },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': {}, 'next-auth/react': {}, 'react-hot-toast': {},
    '@/lib/hospitalUnit': {}, '@/lib/stepNavContext': {}, '@/lib/personName': {}, '@/lib/uncertainty': {},
    '@/lib/amedUcOptions': helpers,
  })
  assert.equal(typeof UcSection, 'function')
  let updated
  const props = {
    label: 'UC1', value: { std: { no: '1021' }, calPoints: [] }, onChange: value => { updated = value },
    instrumentNos: ['1021', '2022'],
    stdRefs: [{ no: '1021', name: 'First' }, { no: '2022', name: 'Second', serialNo: 'S2', correction: 2 }, { no: '9999', name: 'Other' }],
  }
  const select = descendants(UcSection(props)).find(node => node.type === 'select' && node.props['aria-label'] === 'UC1 รหัสเครื่องมือ')
  assert.ok(select)
  assert.equal(select.props.value, '1021')
  assert.deepEqual(descendants(select.props.children).filter(n => n.type === 'option').map(n => n.props.value), ['', '1021', '2022'])
  select.props.onChange({ target: { value: '2022' } })
  assert.equal(updated.std.no, '2022')
  assert.equal(updated.std.name, 'Second')
  assert.equal(updated.std.serialNo, 'S2')
  const existing = descendants(UcSection({ ...props, value: { std: { no: '8888' } } })).find(n => n.type === 'select' && n.props['aria-label'] === 'UC1 รหัสเครื่องมือ')
  assert.equal(existing.props.value, '8888')
  assert.ok(descendants(existing).some(n => n.type === 'option' && n.props.value === '8888'))
})

test('registry create and update return JSON errors when database writes fail', async () => {
  const mongoose = require('mongoose')
  const { single } = routes(new mongoose.Error.CastError('string', ['1021', '2022'], 'uc1'))
  for (const method of ['POST', 'PUT']) {
    const response = await single[method](request({ type: 'ameddevices', _id: 'a'.repeat(24), uc1: ['1021', '2022'] }))
    assert.equal(response.status, 400)
    assert.equal(typeof response.data.error, 'string')
    assert.ok(response.data.error.length > 0)
  }
})
