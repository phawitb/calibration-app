import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  username: string
  password: string
  name: string
  fullName?: string
  rank?: string
  fullNameEn?: string
  rankEn?: string
  /** ตำแหน่ง (TOR 1.1.1.10) */
  position?: string
  role: 'admin' | 'hospital_user' | 'technician' | 'approver'
  hospitalUnit?: string
  amedNo?: string
  /** data URL หรือ path รูปนามสกุล .png สำหรับ PDF */
  signaturePng?: string
  /** bcrypt hash ของรหัส PIN 4–8 หลัก ใช้ยืนยันตัวตนก่อนส่งขออนุมัติ */
  approvalPinHash?: string
  isActive: boolean
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name:     { type: String, required: true },
  fullName: { type: String },
  rank:     { type: String },
  fullNameEn: { type: String },
  rankEn:   { type: String },
  position: { type: String },
  role:     { type: String, enum: ['admin', 'hospital_user', 'technician', 'approver'], default: 'hospital_user' },
  hospitalUnit: { type: String },
  amedNo: { type: String },
  signaturePng: { type: String },
  approvalPinHash: { type: String, select: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
