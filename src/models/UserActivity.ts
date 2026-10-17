import mongoose, { Schema, Document } from 'mongoose'

/** เก็บประวัติการใช้งานไว้ 10 ปี (TTL index) */
export const ACTIVITY_RETENTION_SECONDS = 10 * 365 * 24 * 60 * 60

export type ActivityAction =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'impersonate_start'
  | 'impersonate_stop'
  | 'record_create'
  | 'record_update'
  | 'record_delete'
  | 'record_request_approval'
  | 'record_approve'
  | 'record_reject'
  | 'user_create'
  | 'user_update'
  | 'user_delete'
  | 'certificate_download'
  | 'attachment_upload'
  | 'attachment_delete'
  | 'pin_set'

export const ACTIVITY_ACTIONS: ActivityAction[] = [
  'login_success', 'login_failure', 'logout',
  'impersonate_start', 'impersonate_stop',
  'record_create', 'record_update', 'record_delete', 'record_request_approval',
  'record_approve', 'record_reject',
  'user_create', 'user_update', 'user_delete',
  'certificate_download', 'attachment_upload', 'attachment_delete', 'pin_set',
]

export interface IUserActivity extends Document {
  userId?: string
  username: string
  role?: string
  action: ActivityAction | string
  targetType?: string
  targetId?: string
  detail?: string
  ip?: string
  userAgent?: string
  createdAt: Date
}

const UserActivitySchema = new Schema<IUserActivity>({
  userId:     { type: String, index: true },
  username:   { type: String, required: true, index: true },
  role:       { type: String },
  action:     { type: String, required: true, index: true },
  targetType: { type: String },
  targetId:   { type: String },
  detail:     { type: String },
  ip:         { type: String },
  userAgent:  { type: String },
  createdAt:  { type: Date, default: Date.now },
})

UserActivitySchema.index({ createdAt: -1 }, { expireAfterSeconds: ACTIVITY_RETENTION_SECONDS })
UserActivitySchema.index({ username: 1, createdAt: -1 })
UserActivitySchema.index({ action: 1, createdAt: -1 })

export default mongoose.models.UserActivity ||
  mongoose.model<IUserActivity>('UserActivity', UserActivitySchema)
