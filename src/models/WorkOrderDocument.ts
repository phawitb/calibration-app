import mongoose, { Schema } from 'mongoose'
const schema = new Schema({
  orderId: {
    type: Schema.Types.ObjectId,
    ref: 'WorkOrder',
    required: true,
    index: true,
  },
  fileName: String,
  contentType: String,
  pdfData: { type: Buffer, select: false },
  size: Number,
  uploadedBy: String,
  uploadedAt: { type: Date, default: Date.now },
})
export default mongoose.models.WorkOrderDocument ||
  mongoose.model('WorkOrderDocument', schema)
