import mongoose from 'mongoose'
import { orderActor, orderResponse } from '@/lib/workOrderHttp'
import { requireOrderManager } from '@/lib/workOrderService'
import User from '@/models/User'
import { buildHospitalUnitOptions } from '@/lib/hospitalUnit'
export const GET = () =>
  orderResponse(async () => {
    requireOrderManager(await orderActor())
    const users = await User.find({ isActive: { $ne: false } })
      .select('name fullName username isActive')
      .sort({ name: 1 })
      .lean()
    const units = await mongoose.connection
      .db!.collection('unitnames')
      .find({}, { projection: { name: 1, thaiName: 1 } })
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
    }
  })
