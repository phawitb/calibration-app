import test from 'node:test'
import assert from 'node:assert/strict'
import AmedDevice from '../src/models/AmedDevice'

const keys = ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT']

test('every registry UC stores ordered arrays and accepts legacy single codes', () => {
  for (const key of keys) {
    const device = new AmedDevice({ amedNo: 'test', unitName: 'test', [key]: ['1021', '2022'] })
    assert.equal(device.validateSync(), undefined)
    assert.deepEqual([...device[key]], ['1021', '2022'])
    const legacy = new AmedDevice({ amedNo: 'test', unitName: 'test', [key]: '0012' })
    assert.deepEqual([...legacy[key]], ['0012'])
  }
})

import { AMED_UC_KEYS, normalizeUcOptions, normalizeAmedUcFields, buildAmedUcDefaults } from '../src/lib/amedUcOptions'

test('normalizes legacy values, numeric lists and CSV JSON while preserving order and identifiers', () => {
  assert.deepEqual(normalizeUcOptions('0012'), ['0012'])
  assert.deepEqual(normalizeUcOptions([1021, '2022', '1021', '']), ['1021', '2022'])
  assert.deepEqual(normalizeUcOptions('[1021,2022]'), ['1021', '2022'])
  assert.deepEqual(normalizeUcOptions(JSON.stringify(['0012', '2022'])), ['0012', '2022'])
  for (const empty of [undefined, null, '', []]) assert.deepEqual(normalizeUcOptions(empty), [])
  for (const invalid of [{}, [null], '[bad]']) assert.throws(() => normalizeUcOptions(invalid))
  assert.deepEqual(normalizeAmedUcFields({ uc1: '1021', brand: 'A' }), { uc1: ['1021'], brand: 'A' })
})

test('every UC defaults to first code, allows another configured code and omits empty slots', () => {
  for (const key of AMED_UC_KEYS) {
    const device = { [key]: ['1021', '2022'] }
    assert.deepEqual(buildAmedUcDefaults(device), { [key]: { std: { no: '1021' }, calPoints: [] } })
    assert.deepEqual(buildAmedUcDefaults(device, { [key]: '2022' }), { [key]: { std: { no: '2022' }, calPoints: [] } })
    assert.throws(() => buildAmedUcDefaults(device, { [key]: '9999' }))
  }
  assert.deepEqual(buildAmedUcDefaults({ uc1: [], ucT: '' }), {})
  assert.deepEqual(buildAmedUcDefaults({ uc1: '0012' }), { uc1: { std: { no: '0012' }, calPoints: [] } })
})

import { spawnSync } from 'node:child_process'

test('reloading AmedDevice replaces a cached pre-list schema', () => {
  const result = spawnSync(process.execPath, ['-r', 'sucrase/register', '-e', `
    const mongoose = require('mongoose')
    mongoose.model('AmedDevice', new mongoose.Schema({ uc1: String, ucT: String }))
    const Device = require('./src/models/AmedDevice').default
    const device = new Device({ amedNo: 'test', unitName: 'test', uc1: ['1021', '2022'], ucT: ['3001', '3002'] })
    const error = device.validateSync()
    if (error) { console.error(error.message); process.exit(1) }
    for (const key of ['uc1','uc2','uc3','uc4','uc5','uc6','ucT']) {
      if (Device.schema.path(key)?.instance !== 'Array') process.exit(2)
    }
  `], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})
