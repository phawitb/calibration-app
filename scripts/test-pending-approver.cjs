const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const id = '507f1f77bcf86cd799439011'
const target = '507f191e810c19729de860ea'
function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const exports = {}
  new Function('require', 'exports', code)(name => {
    assert.ok(name in mocks, name)
    return mocks[name]
  }, exports)
  return exports
}
function setup(role = 'admin', status = 'pending_approval', active = true) {
  const record = { _id: id, approvalStatus: status, certNo: 'CERT-001', calibratedById: 'original-technician', approve: '', result: { value: 12 } }
  const calls = []
  const api = load('src/app/api/records/[id]/approver/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    'next-auth': { getServerSession: async () => role ? { user: { role } } : null },
    '@/lib/auth': { authOptions: {} }, '@/lib/mongodb': { connectDB: async () => {} },
    mongoose: require('mongoose'),
    '@/models/User': { findOne: query => {
      assert.deepEqual(query, { _id: target, role: { $in: ['admin', 'approver'] }, isActive: { $ne: false } })
      return { select: () => ({ lean: async () => active ? { fullNameEn: 'New Approver' } : null }) }
    } },
    '@/models/CalibrationRecord': { findOneAndUpdate: async (filter, update) => {
      calls.push({ filter, update })
      if (record.approvalStatus !== filter.approvalStatus) return null
      Object.assign(record, update.$set)
      return record
    } },
  })
  return { record, calls, put: body => api.PUT({ json: async () => body }, { params: { id } }) }
}
for (const role of ['admin', 'technician']) test(`${role} can reassign pending request without changing calibration or certificate`, async () => {
  const env = setup(role)
  const before = structuredClone(env.record)
  const result = await env.put({ requestedApproverId: target, certNo: 'TAMPER', approvalStatus: 'approved', requestedApproverName: 'spoofed' })
  assert.equal(result.status, 200)
  assert.deepEqual(env.record, { ...before, requestedApproverId: target, requestedApproverName: 'New Approver' })
  assert.deepEqual(env.calls[0].filter, { _id: id, approvalStatus: 'pending_approval' })
})
test('unauthenticated, hospital and approver roles cannot reassign', async () => {
  for (const role of [null, 'hospital_user', 'approver']) {
    const env = setup(role)
    assert.equal((await env.put({ requestedApproverId: target })).status, role ? 403 : 401)
    assert.equal(env.calls.length, 0)
  }
})
test('completed, rejected and draft records cannot be reopened by reassignment', async () => {
  for (const status of ['approved', 'rejected', 'draft']) {
    const env = setup('admin', status)
    assert.equal((await env.put({ requestedApproverId: target })).status, 409)
    assert.equal(env.record.approvalStatus, status)
  }
})
test('invalid and inactive approvers cannot be assigned', async () => {
  const env = setup('admin', 'pending_approval', false)
  for (const value of ['', 'bad', null, target]) assert.equal((await env.put({ requestedApproverId: value })).status, 400)
  assert.equal(env.calls.length, 0)
})
test('pending screen offers reassignment only to admin and technician', () => {
  for (const role of ['admin', 'technician', 'approver', 'hospital_user']) {
    const react = require('react')
    const Component = load('src/components/RecordApprovalPanel.tsx', {
      react: { ...react, useEffect: () => {}, useState: value => [value, () => {}] },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'next-auth/react': { useSession: () => ({ data: { user: { role } } }) },
      'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
      'react-hot-toast': {}, '@/lib/recordPersonnel': { formatApproverOption: () => '' },
    }).default
    const html = require('react-dom/server').renderToStaticMarkup(Component({ recordId: id, approvalStatus: 'pending_approval', requestedApproverId: target }))
    assert.equal(html.includes('บันทึกผู้อนุมัติใหม่'), ['admin', 'technician'].includes(role))
  }
})
