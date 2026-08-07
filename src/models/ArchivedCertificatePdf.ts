import mongoose, { Schema, Document } from 'mongoose'

export interface IArchivedCertificatePdf extends Document {
  recordId: string
  certNo: string
  fileName: string
  contentType: string
  pdfData: Buffer
  createdAt: Date
  updatedAt: Date
}

const ArchivedCertificatePdfSchema = new Schema<IArchivedCertificatePdf>(
  {
    recordId: { type: String, required: true, unique: true, index: true },
    certNo: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    contentType: { type: String, default: 'application/pdf' },
    pdfData: { type: Buffer, required: true },
  },
  { timestamps: true }
)

export default mongoose.models.ArchivedCertificatePdf ||
  mongoose.model<IArchivedCertificatePdf>('ArchivedCertificatePdf', ArchivedCertificatePdfSchema)
