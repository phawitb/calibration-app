import mongoose from 'mongoose'
import { orderActor, orderResponse } from '@/lib/workOrderHttp'
import { requireOrderManager } from '@/lib/workOrderService'
import User from '@/models/User'
import { buildHospitalUnitOptions } from '@/lib/hospitalUnit'
export const GET = () =>
  orderResponse(async () => {
    requireOrderManager(await orderActor())
    // ทีมผู้ปฏิบัติงานเลือกได้เฉพาะเจ้าหน้าที่ ไม่รวมผู้ใช้โรงพยาบาล
    const users = await User.find({
      isActive: { $ne: false },
      role: { $in: ['admin', 'technician', 'approver'] },
    })
      .select('name fullName username isActive')
      .sort({ name: 1 })
      .lean()
    const units = await mongoose.connection
      .db!.collection('unitnames')
      .find({}, { projection: { name: 1, thaiName: 1 } })
      .toArray()
    const standards = await mongoose.connection
      .db!.collection('stdinstrumentrefs')
      .find({}, { projection: { no: 1, name: 1, manufacture: 1, model: 1, serialNo: 1, measurement: 1 } })
      .toArray()
    return {
      users: users.map((u: any) => ({
        _id: String(u._id),
        name: u.fullName || u.name,
        username: u.username,
        isActive: u.isActive !== false,
      })),
      hospitals: buildHospitalUnitOptions(
        units as { name?: string; thaiName?: string }[]
      ),
      standards: standards
        .map((s: any) => ({
          _id: String(s._id),
          no: String(s.no ?? '').trim(),
          name: String(s.name ?? '').trim(),
          manufacture: String(s.manufacture ?? '').trim(),
          model: String(s.model ?? '').trim(),
          serialNo: String(s.serialNo ?? '').trim(),
          measurement: String(s.measurement ?? '').trim(),
        }))
        .sort((a, b) => a.no.localeCompare(b.no, undefined, { numeric: true })),
    }
  })
