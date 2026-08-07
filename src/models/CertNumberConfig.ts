import mongoose, { Document, Schema } from 'mongoose'

export interface ICertNumberConfig extends Document {
  key: string
  pattern: string
  startNumber: number
  padding: number
  resetByYear: boolean
  certValidityMonths: number
  alertBeforeDays: number
  createdAt: Date
  updatedAt: Date
}

const CertNumberConfigSchema = new Schema<ICertNumberConfig>(
  {
    key: { type: String, required: true, unique: true, index: true, default: 'default' },
    // ใช้ token: {num}, {yy}, {yyyy}
    pattern: { type: String, default: '{num}/{yy}' },
    startNumber: { type: Number, default: 1 },
    padding: { type: Number, default: 3 },
    resetByYear: { type: Boolean, default: true },
    certValidityMonths: { type: Number, default: 12 },
    alertBeforeDays: { type: Number, default: 30 },
  },
  { timestamps: true }
)

export default mongoose.models.CertNumberConfig ||
  mongoose.model<ICertNumberConfig>('CertNumberConfig', CertNumberConfigSchema)
