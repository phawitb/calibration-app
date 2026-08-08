import mongoose, { Schema, Document } from 'mongoose'

export interface IStdCalPointConfig extends Document {
  instrumentRefId: string
  tableName: string
  points: { pointValue: number; unit: string }[]
  createdAt: Date
  updatedAt: Date
}

const StdCalPointConfigSchema = new Schema<IStdCalPointConfig>(
  {
    instrumentRefId: { type: String, required: true, index: true },
    tableName:       { type: String, required: true },
    points: [
      {
        pointValue: { type: Number, required: true },
        unit:       { type: String, default: '' },
        _id: false,
      },
    ],
  },
  { timestamps: true }
)

export default mongoose.models.StdCalPointConfig ||
  mongoose.model<IStdCalPointConfig>('StdCalPointConfig', StdCalPointConfigSchema)
