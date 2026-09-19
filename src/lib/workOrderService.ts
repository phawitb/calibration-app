import WorkOrder from '../models/WorkOrder'
import WorkOrderDocument from '../models/WorkOrderDocument'
import User from '../models/User'
import AmedDevice from '../models/AmedDevice'
import { getUnitVariants } from './unitVariants'
import {
  canManageOrders,
  orderId,
  OrderError,
  projectOrderForHospital,
  validateWorkOrderInput,
} from './workOrderValidation'
export type OrderActor = { id: string; role?: string; hospitalUnit?: string }
export function requireOrderManager(actor: OrderActor) {
  if (!canManageOrders(actor.role))
    throw new OrderError('ไม่มีสิทธิ์จัดการคำสั่ง', 403)
}
function publicOrder(order: any) {
  const value = JSON.parse(JSON.stringify(order))
  delete value.orderKey
  delete value.usedDeviceIds
  delete value.__v
  return value
}
export async function getOrder(actor: OrderActor, id: string) {
  const order: any = await WorkOrder.findById(orderId(id)).lean()
  if (!order) throw new OrderError('ไม่พบคำสั่ง', 404)
  const result = publicOrder(order)
  if (actor.role === 'hospital_user') {
    const visible = projectOrderForHospital(
      result,
      await getUnitVariants(actor.hospitalUnit)
    )
    if (!visible) throw new OrderError('ไม่พบคำสั่ง', 404)
    return visible
  }
  if (!['admin', 'technician', 'approver'].includes(actor.role || ''))
    throw new OrderError('ไม่มีสิทธิ์ดูคำสั่ง', 403)
  return result
}
export async function listOrders(actor: OrderActor) {
  let query: any = {}
  if (actor.role === 'hospital_user')
    query = {
      'hospitals.unitName': { $in: await getUnitVariants(actor.hospitalUnit) },
    }
  else if (!['admin', 'technician', 'approver'].includes(actor.role || ''))
    throw new OrderError('ไม่มีสิทธิ์ดูคำสั่ง', 403)
  const rows = await WorkOrder.find(query)
    .sort({ startDate: -1, createdAt: -1 })
    .lean()
  const variants =
    actor.role === 'hospital_user'
      ? await getUnitVariants(actor.hospitalUnit)
      : null
  return rows
    .map((r: any) =>
      variants
        ? projectOrderForHospital(publicOrder(r), variants)
        : publicOrder(r)
    )
    .filter(Boolean)
}
async function checkedInput(body: unknown, previous?: any) {
  const input = validateWorkOrderInput(body)
  const members = []
  for (const id of input.memberIds) {
    const user: any = await User.findById(id)
      .select('name fullName username isActive')
      .lean()
    const old = previous?.members?.find((m: any) => String(m._id) === id)
    if (!user && old) {
      members.push({ ...old, isActive: false })
      continue
    }
    if (
      !user ||
      (user.isActive === false && !previous?.memberIds?.includes(id))
    )
      throw new OrderError('กรุณาเลือกผู้ใช้งานที่ยังใช้งานอยู่')
    members.push({
      _id: id,
      name: user.fullName || user.name,
      username: user.username,
      isActive: user.isActive !== false,
    })
  }
  const devices = []
  for (const h of input.hospitals) {
    const variants = await getUnitVariants(h.unitName)
    h.unitName = variants[0] || h.unitName
    for (const id of h.deviceIds) {
      const device: any = await AmedDevice.findById(id).lean()
      const old = previous?.devices?.find(
        (d: any) => String(d._id) === id && d.unitName === h.unitName
      )
      if (old && previous?.usedDeviceIds?.includes(id)) {
        devices.push(old)
        continue
      }
      if (!device && old) {
        devices.push(old)
        continue
      }
      if (
        !device ||
        !variants.includes(device.unitName) ||
        (device.isActive === false && !old)
      )
        throw new OrderError(
          'เครื่องมือไม่อยู่ในโรงพยาบาลที่เลือกหรือไม่พร้อมใช้งาน'
        )
      devices.push({
        _id: id,
        unitName: h.unitName,
        amedNo: String(device.amedNo),
        deviceName: device.deviceName || '',
        brand: device.brand || '',
        model: device.model || '',
        serialNo: device.serialNo || '',
      })
    }
  }
  if (
    new Set(input.hospitals.map((h) => h.unitName)).size !==
    input.hospitals.length
  )
    throw new OrderError('โรงพยาบาลซ้ำกัน')
  return {
    ...input,
    orderKey: input.orderNo.toLocaleLowerCase(),
    members,
    devices,
  }
}
function rethrow(error: any): never {
  if (error?.code === 11000)
    throw new OrderError('เลขที่คำสั่งนี้มีอยู่แล้ว', 409)
  throw error
}
export async function createOrder(actor: OrderActor, body: unknown) {
  requireOrderManager(actor)
  const input = await checkedInput(body)
  await WorkOrder.init()
  try {
    const order = await WorkOrder.create({
      ...input,
      createdBy: actor.id,
      updatedBy: actor.id,
    })
    return publicOrder(order.toObject())
  } catch (e) {
    rethrow(e)
  }
}
export async function updateOrder(actor: OrderActor, id: string, body: any) {
  requireOrderManager(actor)
  orderId(id)
  if (!Number.isSafeInteger(body?.revision) || body.revision < 0)
    throw new OrderError('กรุณาโหลดคำสั่งใหม่ก่อนแก้ไข', 409)
  const previous: any = await WorkOrder.findById(id).lean()
  if (!previous) throw new OrderError('ไม่พบคำสั่ง', 404)
  const input = await checkedInput(body, previous),
    ids = input.hospitals.flatMap((h) => h.deviceIds)
  for (const usedId of previous.usedDeviceIds || []) {
    const before = previous.devices.find((d: any) => String(d._id) === usedId),
      after = input.devices.find((d: any) => String(d._id) === usedId)
    if (!after || !before || before.unitName !== after.unitName)
      throw new OrderError(
        'ไม่สามารถนำเครื่องมือที่เริ่มงานแล้วออกหรือย้ายโรงพยาบาลได้',
        409
      )
  }
  try {
    const updated = await WorkOrder.findOneAndUpdate(
      {
        _id: id,
        revision: body.revision,
        usedDeviceIds: { $not: { $elemMatch: { $nin: ids } } },
      },
      { $set: { ...input, updatedBy: actor.id }, $inc: { revision: 1 } },
      { new: true }
    ).lean()
    if (!updated)
      throw new OrderError(
        'คำสั่งเปลี่ยนแปลงแล้ว หรือมีเครื่องมือที่สร้างงานสอบเทียบแล้ว กรุณาโหลดใหม่และเก็บเครื่องมือที่ใช้งานไว้',
        409
      )
    return publicOrder(updated)
  } catch (e) {
    rethrow(e)
  }
}
export async function deleteOrder(actor: OrderActor, id: string) {
  requireOrderManager(actor)
  await getOrder(actor, id)
  const removed = await WorkOrder.findOneAndDelete({
    _id: id,
    usedDeviceIds: { $size: 0 },
  })
  if (!removed)
    throw new OrderError(
      'คำสั่งนี้มีการเริ่มงานสอบเทียบแล้ว ไม่สามารถลบได้',
      409
    )
  await WorkOrderDocument.deleteMany({ orderId: id })
}
export async function reserveOrderDevice(
  actor: OrderActor,
  id: string,
  deviceId: string,
  unitName: string
) {
  requireOrderManager(actor)
  orderId(id)
  orderId(deviceId)
  const order = await getOrder(actor, id)
  const variants = await getUnitVariants(unitName)
  const device = order.devices.find(
    (d: any) => d._id === deviceId && variants.includes(d.unitName)
  )
  if (!device) throw new OrderError('กรุณาเลือกเครื่องมือและโรงพยาบาลในคำสั่ง')
  const reserved = await WorkOrder.findOneAndUpdate(
    { _id: id, revision: order.revision, 'hospitals.deviceIds': deviceId },
    { $addToSet: { usedDeviceIds: deviceId }, $inc: { revision: 1 } }
  )
  if (!reserved)
    throw new OrderError('คำสั่งมีการเปลี่ยนแปลง กรุณาลองอีกครั้ง', 409)
  return device
}
