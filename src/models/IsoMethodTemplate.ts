import mongoose, { Schema, Document } from 'mongoose'

// ── Sub-schemas ──

const FormFieldSchema = new Schema({
  key:      { type: String, required: true },
  label:    { type: String, required: true },
  labelTh:  { type: String, required: true },
  type:     { type: String, enum: ['text', 'number', 'select', 'checkbox'], default: 'text' },
  options:  [String],
  defaultValue: Schema.Types.Mixed,
  required: { type: Boolean, default: false },
  group:    { type: String },  // group form fields together (e.g. 'chamber', 'probe')
}, { _id: false })

const CmcRangeSchema = new Schema({
  rangeMin:  { type: Number, required: true },  // e.g. -Infinity → use -99999
  rangeMax:  { type: Number, required: true },  // e.g. Infinity → use 99999
  value:     { type: Number, required: true },   // CMC value in method unit
  label:     { type: String },                   // e.g. "< 0°C"
}, { _id: false })

const UncertaintySourceSchema = new Schema({
  key:          { type: String, required: true },  // 'dTCal_Std', 'dT_Drift_Std', etc.
  name:         { type: String, required: true },  // Display name: 'Calibration of STD'
  nameTh:       { type: String },
  type:         { type: String, enum: ['A', 'B'], required: true },
  distribution: { type: String, enum: ['normal', 'rectangular', 'triangular'], required: true },
  divisor:      { type: Number, required: true },  // 2, √3, √6, 1
  sensitivityCoefficient: { type: Number, default: 1 },  // Ci, usually 1 (10 for Ω→°C)

  // Value source configuration
  valueSource: {
    type: {
      type: String,
      enum: [
        'fixed',                    // fixed value (e.g. 0.05)
        'from_std_instrument',      // pull from std1 field
        'from_uuc_resolution',      // UUC resolution / 2
        'computed_repeatability',   // stdev/√n
        'computed_stability',       // (MAX - MIN) / 2
        'computed_uniformity',      // |center - position_i|
        'computed_vertical_uniformity',
        'polynomial_residual',      // MAX(residuals from correction)
        'conditional',              // value depends on condition
        'formula',                  // custom expression
        'from_method_field',        // pull from isoData.methodFields
        'computed_from_data',       // generic computed from measurement data
      ],
      required: true,
    },
    fixedValue:     Number,
    stdField:       String,        // field name on std1 (e.g. 'uTStd', 'uTDrif')
    target:         String,        // for repeatability: 'std' | 'uuc'
    methodFieldKey: String,        // for from_method_field
    conditions: [{                 // for conditional
      condition: String,           // field=value (e.g. 'wireCondition=new')
      value: Number,
    }],
    expression:     String,        // for formula type
    multiplier:     Number,        // optional multiplier (e.g. 0.2 for loading effect)
  },

  degreesOfFreedom: Schema.Types.Mixed,  // number | 'n-1' | 'infinity'
  enabled:   { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { _id: false })

const GridConfigSchema = new Schema({
  sensorCountFixed:   { type: Number },      // fixed sensor count (null if dynamic)
  sensorCountMin:     { type: Number, default: 1 },
  sensorCountMax:     { type: Number, default: 15 },
  sensorCountDynamic: { type: Boolean, default: false },
  sensorLabels:       [String],              // ['Drain','Upper Half','Sensor'] for Autoclave
  readingsPerPoint:   { type: Number, required: true },
  defaultCalPoints:   { type: Number, default: 1 },
  hasStdReadingColumn: { type: Boolean, default: false },  // show STD column in UI
  hasDualChannel:     { type: Boolean, default: false },   // ascending/descending
  // Optional defaults for Liquid Bath vertical uniformity: 10 readings at each position.
  defaultVerticalReadings: {
    center: [Number],
    top: [Number],
    bottom: [Number],
  },
}, { _id: false })

// ── Main Schema ──

export interface IIsoMethodTemplate extends Document {
  code: string
  name: string
  nameTh: string
  deviceType: string
  measurementPattern: 'comparison' | 'spatial_uniformity' | 'comparison_with_ref_bath'
  unit: string
  procedureRef: string  // e.g. 'WI-09-TEM-001'
  methodStandard: string  // e.g. 'TLAS G-20', 'DKD-R 5-7', 'ASTM E 715-80'

  gridConfig: {
    sensorCountFixed?: number
    sensorCountMin: number
    sensorCountMax: number
    sensorCountDynamic: boolean
    sensorLabels: string[]
    readingsPerPoint: number
    defaultCalPoints: number
    hasStdReadingColumn: boolean
    hasDualChannel: boolean
    defaultVerticalReadings?: { center: number[]; top: number[]; bottom: number[] }
  }

  formFields: {
    key: string
    label: string
    labelTh: string
    type: 'text' | 'number' | 'select' | 'checkbox'
    options?: string[]
    defaultValue?: any
    required?: boolean
    group?: string
  }[]

  uncertaintySources: {
    key: string
    name: string
    nameTh?: string
    type: 'A' | 'B'
    distribution: 'normal' | 'rectangular' | 'triangular'
    divisor: number
    sensitivityCoefficient: number
    valueSource: {
      type: string
      fixedValue?: number
      stdField?: string
      target?: string
      methodFieldKey?: string
      conditions?: { condition: string; value: number }[]
      expression?: string
      multiplier?: number
    }
    degreesOfFreedom: number | string
    enabled: boolean
    sortOrder: number
  }[]

  cmcTable: {
    rangeMin: number
    rangeMax: number
    value: number
    label?: string
  }[]

  correctionMethod: 'linear_interpolation' | 'polynomial' | 'none'
  hasTimeCheck: boolean
  hasCalRef: boolean
  hasPressure: boolean
  calibrationPlace: 'both' | 'onsite_only'
  referenceStandards: string[]

  // Environment scope
  envTempScope: { min: number; max: number }
  envHumidityScope: { min: number; max: number }
  hasLineVoltage: boolean

  isActive: boolean
  sortOrder: number
}

const IsoMethodTemplateSchema = new Schema<IIsoMethodTemplate>({
  code:            { type: String, required: true, unique: true },
  name:            { type: String, required: true },
  nameTh:          { type: String, required: true },
  deviceType:      { type: String, required: true },
  measurementPattern: {
    type: String,
    enum: ['comparison', 'spatial_uniformity', 'comparison_with_ref_bath'],
    required: true,
  },
  unit:            { type: String, required: true },
  procedureRef:    { type: String, default: '' },
  methodStandard:  { type: String, default: '' },

  gridConfig:      { type: GridConfigSchema, required: true },
  formFields:      [FormFieldSchema],
  uncertaintySources: [UncertaintySourceSchema],
  cmcTable:        [CmcRangeSchema],

  correctionMethod: {
    type: String,
    enum: ['linear_interpolation', 'polynomial', 'none'],
    default: 'none',
  },
  hasTimeCheck:      { type: Boolean, default: false },
  hasCalRef:         { type: Boolean, default: false },
  hasPressure:       { type: Boolean, default: false },
  calibrationPlace:  { type: String, enum: ['both', 'onsite_only'], default: 'both' },
  referenceStandards: [String],

  envTempScope:      { min: { type: Number, default: 18 }, max: { type: Number, default: 28 } },
  envHumidityScope:  { min: { type: Number, default: 40 }, max: { type: Number, default: 80 } },
  hasLineVoltage:    { type: Boolean, default: false },

  isActive:   { type: Boolean, default: true },
  sortOrder:  { type: Number, default: 0 },
}, {
  timestamps: true,
})

export default mongoose.models.IsoMethodTemplate ||
  mongoose.model<IIsoMethodTemplate>('IsoMethodTemplate', IsoMethodTemplateSchema)
