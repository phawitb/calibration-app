import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { encode } from 'next-auth/jwt'
import WorkOrder from '../src/models/WorkOrder'
import User from '../src/models/User'
import AmedDevice from '../src/models/AmedDevice'
import CalibrationRecord from '../src/models/CalibrationRecord'
const base = 'http://localhost:3001',
  secret = 'work-orders-local-test-secret-only'
test('HTTP orders, documents and both calibration types preserve scope and history', async () => {
  await mongoose.connect('mongodb://127.0.0.1:27028/work_orders_e2e')
  try {
    await mongoose.connection.dropDatabase()
    await WorkOrder.createIndexes()
    const password = await bcrypt.hash('local-test-only', 4)
    const users: any = {}
    for (const role of ['admin', 'technician', 'approver', 'hospital_user'])
      users[role] = await User.create({
        username: `test-${role}`,
        name: role === 'technician' ? 'เจ้าหน้าที่ทดสอบ' : 'ผู้ใช้ทดสอบ',
        password,
        role,
        hospitalUnit: role === 'hospital_user' ? 'โรงพยาบาลทดสอบ A' : '',
      })
    await mongoose.connection
      .db!.collection('unitnames')
      .insertMany([{ name: 'โรงพยาบาลทดสอบ A' }, { name: 'โรงพยาบาลทดสอบ B' }])
    const a = await AmedDevice.create({
        unitName: 'โรงพยาบาลทดสอบ A',
        amedNo: '1001',
        deviceName: 'เครื่องวัดความดัน',
        model: 'Test A',
        serialNo: 'A-001',
      }),
      b = await AmedDevice.create({
        unitName: 'โรงพยาบาลทดสอบ B',
        amedNo: '1001',
        deviceName: 'เครื่องควบคุมอุณหภูมิ',
        model: 'Test B',
        serialNo: 'B-001',
      })
    const tokens: any = {}
    for (const [role, u] of Object.entries(users) as any)
      tokens[role] = await encode({
        secret,
        token: {
          id: String(u._id),
          role,
          username: u.username,
          hospitalUnit: u.hospitalUnit,
          name: u.name,
        },
      })
    const api = async (
      path: string,
      role = 'admin',
      method = 'GET',
      body?: any
    ) => {
      const form = body instanceof FormData
      const r = await fetch(base + path, {
        method,
        headers: {
          Cookie: `next-auth.session-token=${tokens[role]}`,
          ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? (form ? body : JSON.stringify(body)) : undefined,
      })
      const data = r.headers.get('content-type')?.includes('json')
        ? await r.json()
        : await r.text()
      return { status: r.status, body: data, headers: r.headers }
    }
    const unauthorized = await fetch(base + '/api/orders')
    assert.equal(unauthorized.status, 401)
    const input = {
      orderNo: 'คำสั่งทดสอบ 1/2569',
      title: 'ออกปฏิบัติงานสอบเทียบประจำปี',
      startDate: '2026-09-19',
      endDate: '2026-09-21',
      notes: 'ข้อมูลสำหรับทดสอบระบบเท่านั้น',
      hospitals: [
        { unitName: a.unitName, deviceIds: [String(a._id)] },
        { unitName: b.unitName, deviceIds: [String(b._id)] },
      ],
      memberIds: [String(users.technician._id), String(users.admin._id)],
    }
    assert.equal(
      (await api('/api/orders', 'approver', 'POST', input)).status,
      403
    )
    const created = await api('/api/orders', 'technician', 'POST', input)
    assert.equal(created.status, 201, JSON.stringify(created.body))
    const order = created.body.data,
      oid = order._id
    assert.equal((await api('/api/orders', 'admin', 'POST', input)).status, 409)
    const options = await api('/api/orders/options', 'technician')
    assert.equal(options.status, 200)
    assert.equal('password' in options.body.data.users[0], false)
    const visible = await api(`/api/orders/${oid}`, 'hospital_user')
    assert.equal(visible.body.data.hospitals.length, 1)
    assert.equal(visible.body.data.devices.length, 1)
    assert.equal(
      (await api(`/api/orders/${oid}/documents`, 'hospital_user')).status,
      403
    )
    const pdf =
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
    const upload = new FormData()
    upload.append(
      'file',
      new Blob([pdf], { type: 'application/pdf' }),
      'คำสั่ง.pdf'
    )
    const document = await api(
      `/api/orders/${oid}/documents`,
      'technician',
      'POST',
      upload
    )
    assert.equal(document.status, 201, JSON.stringify(document.body))
    const did = document.body.data._id
    const download = await api(`/api/orders/${oid}/documents/${did}?download=1`)
    assert.equal(download.body, pdf)
    assert.match(download.headers.get('content-disposition')!, /^attachment/)
    assert.equal(
      (await api(`/api/orders/${oid}/documents/${did}`, 'hospital_user'))
        .status,
      403
    )
    const metadata = await api(`/api/orders/${oid}/documents`)
    assert.equal('pdfData' in metadata.body.data[0], false)
    const invalid = new FormData()
    invalid.append(
      'file',
      new Blob(['fake'], { type: 'application/pdf' }),
      'bad.pdf'
    )
    assert.equal(
      (await api(`/api/orders/${oid}/documents`, 'admin', 'POST', invalid))
        .status,
      400
    )
    const devices = await api(
      `/api/ameddevices?workOrderId=${oid}`,
      'hospital_user'
    )
    assert.equal(devices.body.data.length, 1)
    const common = {
      workOrderId: oid,
      workOrderDeviceId: String(a._id),
      unitName: a.unitName,
      amedNo: '1001',
      deviceName: 'spoofed',
    }
    assert.equal(
      (
        await api('/api/records', 'technician', 'POST', {
          ...common,
          workOrderDeviceId: String(b._id),
          calibrationType: 'sbcal',
        })
      ).status,
      400
    )
    assert.equal(
      (
        await api('/api/records', 'technician', 'POST', {
          unitName: a.unitName,
          calibrationType: 'sbcal',
        })
      ).status,
      400
    )
    for (const calibrationType of ['sbcal', 'iso']) {
      const body = {
        ...common,
        calibrationType,
        isoMethodCode: calibrationType === 'iso' ? 'TEM-002' : undefined,
      }
      const result = await api('/api/records', 'technician', 'POST', body)
      assert.equal(result.status, 201, JSON.stringify(result.body))
      const record = result.body.record
      assert.equal(record.deviceName, a.deviceName)
      assert.equal(record.workOrderId, oid)
      assert.equal(record.certNo, undefined)
      const reused = await api('/api/records', 'technician', 'POST', body)
      assert.equal(reused.status, 200)
      assert.equal(reused.body.record._id, record._id)
      assert.equal(
        (
          await api(`/api/records/${record._id}`, 'technician', 'PUT', {
            workOrderId: '',
          })
        ).status,
        409
      )
      const edited = await api(
        `/api/records/${record._id}`,
        'technician',
        'PUT',
        { ...record, saveAction: 'draft' }
      )
      assert.equal(edited.status, 200, JSON.stringify(edited.body))
    }
    assert.equal(
      (await api(`/api/orders/${oid}`, 'technician', 'DELETE')).status,
      409
    )
    const latest = await api(`/api/orders/${oid}`)
    assert.equal(
      (
        await api(`/api/orders/${oid}`, 'technician', 'PUT', {
          ...input,
          revision: latest.body.data.revision,
          hospitals: [input.hospitals[1]],
        })
      ).status,
      409
    )
    const historical = await CalibrationRecord.create({
      unitName: a.unitName,
      amedNo: 'old',
      savedOnce: true,
      createdBy: users.technician.username,
    })
    assert.equal(
      (
        await api(`/api/records/${historical._id}`, 'technician', 'PUT', {
          remarks: ['historical remains editable'],
        })
      ).status,
      200
    )
    assert.equal(
      (
        await api(`/api/records/${historical._id}`, 'technician', 'PUT', {
          workOrderId: oid,
        })
      ).status,
      409
    )
    // Keep fixture only in this dedicated local database for visual verification.
  } finally {
    await mongoose.disconnect()
  }
})
