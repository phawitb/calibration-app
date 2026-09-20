import mongoose, { Schema } from 'mongoose'
const schema = new Schema({
  key: {type: String, unique: true, required: true},
  texts: {type: Schema.Types.Mixed, default: {}},
  revision: {type: Number, default: 1},
  changedBy: String,
}, {timestamps: true})
export default mongoose.models.CertificateTextConfig || mongoose.model('CertificateTextConfig', schema)
