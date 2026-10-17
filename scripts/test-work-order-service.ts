import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import User from '../src/models/User'
import AmedDevice from '../src/models/AmedDevice'
import WorkOrder from '../src/models/WorkOrder'
import {
  createOrder,
  updateOrder,
  deleteOrder,
  getOrder,
  reserveOrderDevice,
} from '../src/lib/workOrderService'
test('order service validates users, hospitals, permissions and concurrent reservations', async () => {
  await mongoose.connect(process.env.WORK_ORDER_TEST_MONGO_URI || 'mongodb://127.0.0.1:27028/work_orders_test')
  try {
    await mongoose.connection.dropDatabase()
    await WorkOrder.init()
    const member = await User.create({
      username: 'member',
      password: 'unused',
      name: 'Member',
      role: 'technician',
    })
    const admin = { id: String(member._id), role: 'admin' },
      tech = { ...admin, role: 'technician' }
    const a = await AmedDevice.create({
        unitName: 'A',
        amedNo: '1',
        deviceName: 'A device',
      }),
      b = await AmedDevice.create({
        unitName: 'B',
        amedNo: '1',
        deviceName: 'B device',
      })
    const input = {
      orderNo: '1/69',
      title: 'Test',
      startDate: '2026-09-19',
      endDate: '2026-09-20',
      notes: '',
      memberIds: [String(member._id)],
      hospitals: [
        { unitName: 'A', deviceIds: [String(a._id)] },
        { unitName: 'B', deviceIds: [String(b._id)] },
      ],
    }
    await assert.rejects(
      () => createOrder({ ...admin, role: 'approver' }, input),
      { status: 403 }
    )
    await assert.rejects(
      () =>
        createOrder(admin, {
          ...input,
          hospitals: [{ unitName: 'A', deviceIds: [String(b._id)] }],
        }),
      { status: 400 }
    )
    const order: any = await createOrder(tech, input),
      id = String(order._id)
    await assert.rejects(() => createOrder(admin, input), { status: 409 })
    const view: any = await getOrder(
      { ...admin, role: 'hospital_user', hospitalUnit: 'A' },
      id
    )
    assert.equal(view.hospitals.length, 1)
    assert.equal(view.devices.length, 1)
    await assert.rejects(
      () =>
        getOrder({ ...admin, role: 'hospital_user', hospitalUnit: 'C' }, id),
      { status: 404 }
    )
    await User.updateOne({ _id: member._id }, { $set: { isActive: false } })
    const updated: any = await updateOrder(tech, id, {
      ...input,
      title: 'Edited',
      revision: order.revision,
    })
    assert.equal(updated.members[0].isActive, false)
    await assert.rejects(
      () => updateOrder(admin, id, { ...input, revision: order.revision }),
      { status: 409 }
    )
    await assert.rejects(
      () => reserveOrderDevice(admin, id, String(b._id), 'A'),
      { status: 400 }
    )
    const outcomes = await Promise.allSettled([
      reserveOrderDevice(admin, id, String(a._id), 'A'),
      updateOrder(admin, id, {
        ...input,
        revision: updated.revision,
        hospitals: [input.hospitals[1]],
      }),
    ])
    assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1)
    const current: any = await getOrder(admin, id)
    if (current.hospitals.some((h: any) => h.unitName === 'A')) {
      await assert.rejects(() => deleteOrder(admin, id), { status: 409 })
    } else {
      await deleteOrder(admin, id)
      await assert.rejects(() => getOrder(admin, id), { status: 404 })
    }
    await User.updateOne({ _id: member._id }, { $set: { isActive: true } })
    const binding: any = await createOrder(admin, {
      ...input,
      orderNo: 'binding',
      hospitals: [input.hospitals[0]],
    })
    await reserveOrderDevice(admin, String(binding._id), String(a._id), 'A')
    await AmedDevice.updateOne({ _id: a._id }, { $set: { unitName: 'C' } })
    const revision: any = await getOrder(admin, String(binding._id))
    await assert.rejects(
      () =>
        updateOrder(admin, String(binding._id), {
          ...input,
          orderNo: 'binding',
          revision: revision.revision,
          hospitals: [{ unitName: 'C', deviceIds: [String(a._id)] }],
        }),
      { status: 409 }
    )
    const retained: any = await updateOrder(admin, String(binding._id), {
      ...input,
      orderNo: 'binding',
      revision: revision.revision,
      hospitals: [input.hospitals[0]],
    })
    assert.equal(retained.devices[0].unitName, 'A')
  } finally {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
test('orders carry standard instruments and lock the ones records already use', async () => {
  await mongoose.connect(process.env.WORK_ORDER_TEST_MONGO_URI || 'mongodb://127.0.0.1:27028/work_orders_test')
  try {
    await mongoose.connection.dropDatabase()
    await WorkOrder.init()
    const member = await User.create({ username: 'm2', password: 'unused', name: 'M2', role: 'technician' })
    const admin = { id: String(member._id), role: 'admin' }
    const device = await AmedDevice.create({ unitName: 'A', amedNo: '7', deviceName: 'Dev' })
    const refs = mongoose.connection.db!.collection('stdinstrumentrefs')
    const { insertedIds } = await refs.insertMany([
      { no: '1021', name: 'Data Logger', model: 'BL-1D', serialNo: 'S1' },
      { no: '2002', name: 'Thermometer', model: 'T', serialNo: 'S2' },
    ])
    const stdA = String(insertedIds[0]), stdB = String(insertedIds[1])
    const input = {
      orderNo: '2/69', title: 'Std', startDate: '2026-09-19', endDate: '2026-09-20', notes: '',
      memberIds: [String(member._id)],
      hospitals: [{ unitName: 'A', deviceIds: [String(device._id)] }],
      standardIds: [stdA, stdB],
    }
    await assert.rejects(
      () => createOrder(admin, { ...input, standardIds: ['f'.repeat(24)] }),
      { status: 400 }
    )
    const order: any = await createOrder(admin, input)
    assert.deepEqual(order.standards.map((s: any) => s.no), ['1021', '2002'])
    const { assertRecordStandardsInOrder } = await import('../src/lib/workOrderService')
    await assert.rejects(
      () => assertRecordStandardsInOrder(order._id, { std1: { no: '9999' } }),
      { status: 409 }
    )
    await assertRecordStandardsInOrder(order._id, { std1: { no: '1021' } })
    // record ในคำสั่งใช้ 1021 แล้ว → ถอด 1021 ไม่ได้ แต่ถอด 2002 ได้
    const CalibrationRecord = (await import('../src/models/CalibrationRecord')).default
    await CalibrationRecord.create({
      workOrderId: String(order._id), workOrderDeviceId: String(device._id),
      unitName: 'A', amedNo: '7', std1: { no: '1021', name: 'Data Logger' },
    })
    await assert.rejects(
      () => updateOrder(admin, String(order._id), { ...input, revision: order.revision, standardIds: [stdB] }),
      { status: 409 }
    )
    const trimmed: any = await updateOrder(admin, String(order._id), { ...input, revision: order.revision, standardIds: [stdA] })
    assert.deepEqual(trimmed.standards.map((s: any) => s.no), ['1021'])
    // เลิกจำกัดทั้งหมด (ว่าง) ทำได้เสมอ
    const open: any = await updateOrder(admin, String(order._id), { ...input, revision: trimmed.revision, standardIds: [] })
    assert.equal(open.standards.length, 0)
  } finally {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
  }
})
