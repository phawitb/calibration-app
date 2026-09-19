import mongoose, { Schema, Document } from 'mongoose'

export interface IAmedDevice extends Omit<Document, 'model'> {
  amedNo: string
  unitName: string
  section?: string
  deviceName?: string
  brand?: string
  model?: string
  serialNo?: string
  hpNumber?: string
  toSelect?: boolean
  uc1?: string[]
  uc2?: string[]
  uc3?: string[]
  uc4?: string[]
  uc5?: string[]
  uc6?: string[]
  ucT?: string[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const AmedDeviceSchema = new Schema<IAmedDevice>(
  {
    amedNo:       { type: String, required: true },
    unitName:     { type: String, required: true, index: true },
    section:      { type: String },
    deviceName:   { type: String },
    brand:        { type: String },
    model:        { type: String },
    serialNo:     { type: String },
    hpNumber:     { type: String },
    toSelect:     { type: Boolean, default: false },
    uc1:          { type: [String], default: [] },
    uc2:          { type: [String], default: [] },
    uc3:          { type: [String], default: [] },
    uc4:          { type: [String], default: [] },
    uc5:          { type: [String], default: [] },
    uc6:          { type: [String], default: [] },
    ucT:          { type: [String], default: [] },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true }
)

AmedDeviceSchema.index({ unitName: 1, amedNo: 1 }, { unique: true })

// Hot reload can retain the former scalar (or generic reference) schema.
const cachedModel = mongoose.models.AmedDevice
if (cachedModel && ['uc1', 'uc2', 'uc3', 'uc4', 'uc5', 'uc6', 'ucT'].some(
  key => cachedModel.schema.path(key)?.instance !== 'Array'
)) {
  mongoose.deleteModel('AmedDevice')
}

export default mongoose.models.AmedDevice ||
  mongoose.model<IAmedDevice>('AmedDevice', AmedDeviceSchema)
