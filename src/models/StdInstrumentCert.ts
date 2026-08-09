import mongoose, { Schema, Document } from 'mongoose'

export interface IStdInstrumentCert extends Document {
  instrumentRefId: string
  year: number
  certNo?: string
  fileName: string
  pdfData: Buffer
  expiryDate?: Date
  isLatest: boolean
  uploadedAt: Date
}

const StdInstrumentCertSchema = new Schema<IStdInstrumentCert>({
  instrumentRefId: { type: String, required: true, index: true },
  year:            { type: Number, required: true },
  certNo:          { type: String },
  fileName:        { type: String, required: true },
  pdfData:         { type: Buffer, required: true },
  expiryDate:      { type: Date },
  isLatest:        { type: Boolean, default: false },
  uploadedAt:      { type: Date, default: Date.now },
})

StdInstrumentCertSchema.index({ instrumentRefId: 1, year: 1 }, { unique: true })

export default mongoose.models.StdInstrumentCert ||
  mongoose.model<IStdInstrumentCert>('StdInstrumentCert', StdInstrumentCertSchema)
