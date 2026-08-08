import mongoose, { Schema, Document } from 'mongoose'

export interface IUserCertificate extends Document {
  userId: mongoose.Types.ObjectId
  fileName: string
  contentType: string
  pdfData: Buffer
  uploadedAt: Date
}

const UserCertificateSchema = new Schema<IUserCertificate>({
  userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName:    { type: String, required: true },
  contentType: { type: String, default: 'application/pdf' },
  pdfData:     { type: Buffer, required: true },
  uploadedAt:  { type: Date, default: Date.now },
})

export default mongoose.models.UserCertificate ||
  mongoose.model<IUserCertificate>('UserCertificate', UserCertificateSchema)
