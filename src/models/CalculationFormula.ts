import mongoose, { Schema, Document } from 'mongoose'

export interface ICalculationFormula extends Document {
  code: string
  name: string
  description: string
  isDefault: boolean
  isActive: boolean
  confidenceLevel: number
  divisorNormal: number
  divisorRect: number
  numReadings: number
  forceK: number | null
  createdAt: Date
  updatedAt: Date
}

const CalculationFormulaSchema = new Schema<ICalculationFormula>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    confidenceLevel: { type: Number, default: 0.9545 },
    divisorNormal: { type: Number, default: 2 },
    divisorRect: { type: Number, default: 1.732050808 },
    numReadings: { type: Number, default: 4 },
    forceK: { type: Number, default: null },
  },
  { timestamps: true }
)

export default mongoose.models.CalculationFormula ||
  mongoose.model<ICalculationFormula>('CalculationFormula', CalculationFormulaSchema)
