import mongoose, { Schema, Document } from 'mongoose'

/** กำหนด Amed เป็นคีย์ — สะสมหลายเลข cert ต่อ Amed ไว้ในประวัติ */
export interface IAmedCertHistory extends Document {
  amedNo: string
  certNo: string
  recordId: string
  createdAt: Date
  updatedAt: Date
}

const AmedCertHistorySchema = new Schema<IAmedCertHistory>(
  {
    amedNo:   { type: String, required: true, index: true },
    certNo:   { type: String, required: true },
    recordId: { type: String, required: true, index: true },
  },
  { timestamps: true }
)

AmedCertHistorySchema.index({ amedNo: 1, certNo: 1 }, { unique: true })

export default mongoose.models.AmedCertHistory ||
  mongoose.model<IAmedCertHistory>('AmedCertHistory', AmedCertHistorySchema)
