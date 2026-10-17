import mongoose, { Document, Schema } from 'mongoose'

export interface ICertNumberConfig extends Document {
  key: string
  pattern: string
  startNumber: number
  padding: number
  resetByYear: boolean
  certValidityMonths: number
  alertBeforeDays: number
  /** ต้องตรวจสภาวะแวดล้อมก่อนขออนุมัติ/อนุมัติ (TOR 1.2.2.3) */
  requireEnvironment: boolean
  envTempMin: number
  envTempMax: number
  envHumidMin: number
  envHumidMax: number
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
    requireEnvironment: { type: Boolean, default: true },
    envTempMin: { type: Number, default: 15 },
    envTempMax: { type: Number, default: 35 },
    envHumidMin: { type: Number, default: 20 },
    envHumidMax: { type: Number, default: 80 },
  },
  { timestamps: true }
)

export default mongoose.models.CertNumberConfig ||
  mongoose.model<ICertNumberConfig>('CertNumberConfig', CertNumberConfigSchema)
