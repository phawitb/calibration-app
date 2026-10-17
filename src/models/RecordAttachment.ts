import mongoose, { Schema, Document } from 'mongoose'

export const ATTACHMENT_KINDS = ['external_result', 'other'] as const
export type AttachmentKind = typeof ATTACHMENT_KINDS[number]

export const ATTACHMENT_MAX_SIZE = 8 * 1024 * 1024 // 8 MB
export const ATTACHMENT_CONTENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const

/** ตรวจชนิดไฟล์จาก magic bytes (ไม่เชื่อ Content-Type ที่ client ส่งมา) */
export function sniffAttachmentType(bytes: Uint8Array): typeof ATTACHMENT_CONTENT_TYPES[number] | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'application/pdf' // %PDF-
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

export interface IRecordAttachment extends Document {
  recordId: mongoose.Types.ObjectId
  kind: AttachmentKind
  fileName: string
  contentType: string
  size: number
  data: Buffer
  uploadedBy: string
  uploadedById?: string
  note?: string
  createdAt: Date
}

const RecordAttachmentSchema = new Schema<IRecordAttachment>({
  recordId:     { type: Schema.Types.ObjectId, ref: 'CalibrationRecord', required: true, index: true },
  kind:         { type: String, enum: ATTACHMENT_KINDS, default: 'external_result' },
  fileName:     { type: String, required: true },
  contentType:  { type: String, enum: ATTACHMENT_CONTENT_TYPES, required: true },
  size:         { type: Number, required: true, max: ATTACHMENT_MAX_SIZE },
  data:         { type: Buffer, required: true, select: false },
  uploadedBy:   { type: String, required: true },
  uploadedById: { type: String },
  note:         { type: String, maxlength: 500 },
  createdAt:    { type: Date, default: Date.now },
})

RecordAttachmentSchema.index({ recordId: 1, createdAt: -1 })

export default mongoose.models.RecordAttachment ||
  mongoose.model<IRecordAttachment>('RecordAttachment', RecordAttachmentSchema)
