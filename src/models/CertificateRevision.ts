import mongoose, { Schema } from 'mongoose'
const schema = new Schema({
  recordId: { type: String, required: true, index: true }, certNo: String,
  revision: { type: Number, required: true }, recordSnapshot: { type: Schema.Types.Mixed, required: true },
  pdfData: { type: Buffer, required: true, select: false }, fileName: String,
  instrumentRefId: { type: String, index: true }, referenceYear: Number,
  targetVersionId: String, changedBy: String,
}, { timestamps: true })
schema.index({ recordId: 1, revision: 1 }, { unique: true })
export default mongoose.models.CertificateRevision || mongoose.model('CertificateRevision', schema)
