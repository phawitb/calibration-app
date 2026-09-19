import mongoose, { Schema } from 'mongoose'
const schema = new Schema(
  {
    orderNo: { type: String, required: true },
    orderKey: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    startDate: String,
    endDate: String,
    notes: String,
    hospitals: [{ _id: false, unitName: String, deviceIds: [String] }],
    memberIds: [String],
    members: [
      { _id: String, name: String, username: String, isActive: Boolean },
    ],
    devices: [
      {
        _id: String,
        unitName: String,
        amedNo: String,
        deviceName: String,
        model: String,
        serialNo: String,
        brand: String,
      },
    ],
    usedDeviceIds: { type: [String], default: [] },
    revision: { type: Number, default: 0 },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)
export default mongoose.models.WorkOrder || mongoose.model('WorkOrder', schema)
