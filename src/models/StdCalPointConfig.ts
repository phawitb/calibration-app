import mongoose, { Schema, Document } from 'mongoose'

export interface IStdCalPointConfig extends Document {
  instrumentRefId: string
  tableName: string
  points: { pointValue: number; unit: string }[]
  stdValues: number[]
  order: number
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
    stdValues:       [{ type: Number }],
    order:           { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Delete cached model to pick up schema changes during dev HMR
if (mongoose.models.StdCalPointConfig) {
  delete (mongoose.models as any).StdCalPointConfig
  delete (mongoose.connection.models as any).StdCalPointConfig
}

export default mongoose.model<IStdCalPointConfig>('StdCalPointConfig', StdCalPointConfigSchema)
