import mongoose, { Schema } from 'mongoose'
const schema = new Schema({
  instrumentRefId: { type: String, required: true, index: true },
  year: { type: Number, required: true }, revision: { type: Number, required: true },
  fields: { type: Schema.Types.Mixed, required: true }, calPoints: { type: [Schema.Types.Mixed], default: [] },
  pdf: { type: Schema.Types.Mixed }, pdfData: { type: Buffer, select: false },
  changedBy: String,
}, { timestamps: true })
schema.index({ instrumentRefId: 1, year: 1, revision: 1 }, { unique: true })
export default mongoose.models.StandardInstrumentYear || mongoose.model('StandardInstrumentYear', schema)
