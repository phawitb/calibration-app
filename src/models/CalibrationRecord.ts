import mongoose, { Schema, Document } from 'mongoose'

// Sub-schema for calibration instrument reference
const StdInstrumentSchema = new Schema({
  no:          String,
  name:        String,
  manufacture: String,
  model:       String,
  serialNo:    String,
  certNo:      String,
  measurement: String,
  unit:        String,
  calDate:     String,
  correction:  Number,
  uTStd:       Number,
  uTDrif:      Number,
  uTResStd:    Number,
  uTUuc:       Number,
  uTInt:       Number,
  tMin:        Number,
  tMax:        Number,
  hMin:        Number,
  hMax:        Number,
}, { _id: false })

// Sub-schema for a single calibration point reading
const CalPointSchema = new Schema({
  point:  mongoose.Schema.Types.Mixed, // calibration point value
  readings: [Number], // UUC readings (up to 4)
  standards: [Number], // STD readings (up to 4)
}, { _id: false })

// Sub-schema for one uncertainty component (Uc)
const UcSchema = new Schema({
  std:       StdInstrumentSchema,
  calPoints: [CalPointSchema], // up to 6 cal points
  formulaId:   { type: String, default: null },
  formulaCode: { type: String, default: 'standard' },
}, { _id: false })

// Sub-schema for time-based calibration (UcT)
const UcTimeSchema = new Schema({
  std:       StdInstrumentSchema,
  calPoints: [CalPointSchema], // up to 6 cal points
  formulaId:   { type: String, default: null },
  formulaCode: { type: String, default: 'standard' },
}, { _id: false })

// Omit Document.model — field name "model" (device model) collides with Mongoose Document#model
export interface ICalibrationRecord extends Omit<Document, 'model'> {
  // Device info
  recordNo:     number
  sbNo:         string
  amedNo:       string
  amedCertKey?: string
  select:       boolean
  certNo:       string

  unitName:     string
  address:      string
  section:      string
  deviceName:   string
  brand:        string
  model:        string
  serialNo:     string
  hpNumber:     string

  issuedDate:   Date
  receivedN:    string
  receivedDate: Date
  calDate:      Date
  location:     string

  lapTemp:      number
  lapHumid:     number
  calibrate:    string
  approve:      string
  /** ผู้ทำรายการสอบเทียบ (ลงลายเซ็น) — อ้างอิง User */
  calibratedById?: string
  calPrice:     number
  mainPrice:    number
  approvalStatus?: 'draft' | 'pending_approval' | 'approved'
  requestedApproverId?: string
  requestedApproverName?: string
  approvedById?: string
  approvedByName?: string
  approvedAt?: Date

  // Environmental standard instrument (same uncertainty fields as StdInstrumentSchema in Uc)
  std1: {
    no:          string
    name:        string
    manufacture: string
    model:       string
    serialNo:    string
    certNo:      string
    measurement: string
    unit:        string
    calDate:     string
    correction:  number
    uTStd:       number
    uTDrif:      number
    uTResStd:    number
    uTUuc:       number
    uTInt:       number
    tMin:        number
    tMax:        number
    hMin:        number
    hMax:        number
  }

  // Uncertainty components Uc1-Uc6 (normal instruments)
  uc1: typeof UcSchema
  uc2: typeof UcSchema
  uc3: typeof UcSchema
  uc4: typeof UcSchema
  uc5: typeof UcSchema
  uc6: typeof UcSchema

  // Time-based uncertainty component
  ucT: typeof UcTimeSchema

  remarks: string[]
  images:  string[]

  createdAt: Date
  updatedAt: Date
  createdBy: string

  calibrationType: 'sbcal' | 'iso'
  isoMethodCode?: string
  isoData?: {
    receivedNumber?: string
    certificateNo?: string
    idNumber?: string
    uucResolution?: number
    condition?: string
    calibrationPlace?: string
    referenceStandard?: string
    startTime?: string
    endTime?: string
    sensorType?: string
    probeCount?: number
    calPoints: {
      point: any
      sensorReadings: number[][]  // [reading_index][sensor_index]
      standardCorrection?: number
    }[]
    timeCheck?: {
      uucTime: string[]
      stdTime: string[]
    }
  }
}

const IsoCalPointSchema = new Schema({
  point: mongoose.Schema.Types.Mixed,
  sensorReadings: [[Number]],
  standardCorrection: Number,
}, { _id: false })

const IsoDataSchema = new Schema({
  receivedNumber: String,
  certificateNo: String,
  idNumber: String,
  uucResolution: Number,
  condition: String,
  calibrationPlace: String,
  referenceStandard: String,
  startTime: String,
  endTime: String,
  sensorType: String,
  probeCount: Number,
  calPoints: [IsoCalPointSchema],
  timeCheck: {
    uucTime: [String],
    stdTime: [String],
  },
}, { _id: false })

const CalibrationRecordSchema = new Schema<ICalibrationRecord>({
  recordNo:     { type: Number },
  sbNo:         { type: String },
  amedNo:       { type: String, index: true },
  amedCertKey:  { type: String, index: true },
  select:       { type: Boolean, default: false },
  certNo:       { type: String },

  unitName:     { type: String },
  address:      { type: String },
  section:      { type: String },
  deviceName:   { type: String },
  brand:        { type: String },
  model:        { type: String },
  serialNo:     { type: String },
  hpNumber:     { type: String },

  issuedDate:   { type: Date },
  receivedN:    { type: String },
  receivedDate: { type: Date },
  calDate:      { type: Date },
  location:     { type: String },

  lapTemp:      { type: Number },
  lapHumid:     { type: Number },
  calibrate:    { type: String },
  approve:      { type: String },
  calibratedById: { type: String, index: true },
  calPrice:     { type: Number },
  mainPrice:    { type: Number },
  approvalStatus: { type: String, enum: ['draft', 'pending_approval', 'approved'], default: 'draft' },
  requestedApproverId: { type: String },
  requestedApproverName: { type: String },
  approvedById: { type: String },
  approvedByName: { type: String },
  approvedAt: { type: Date },

  std1: {
    no:          String,
    name:        String,
    manufacture: String,
    model:       String,
    serialNo:    String,
    certNo:      String,
    measurement: String,
    unit:        String,
    calDate:     String,
    correction:  Number,
    uTStd:       Number,
    uTDrif:      Number,
    uTResStd:    Number,
    uTUuc:       Number,
    uTInt:       Number,
    tMin:        Number,
    tMax:        Number,
    hMin:        Number,
    hMax:        Number,
  },

  uc1: UcSchema,
  uc2: UcSchema,
  uc3: UcSchema,
  uc4: UcSchema,
  uc5: UcSchema,
  uc6: UcSchema,
  ucT: UcTimeSchema,

  remarks:   [String],
  images:    [String],
  createdBy: { type: String },

  calibrationType: { type: String, enum: ['sbcal', 'iso'], default: 'sbcal', index: true },
  isoMethodCode: { type: String, index: true },
  isoData: IsoDataSchema,
}, {
  timestamps: true,
})

// Text index for search
CalibrationRecordSchema.index({
  deviceName: 'text',
  amedNo:     'text',
  certNo:     'text',
  unitName:   'text',
  section:    'text',
})

export default mongoose.models.CalibrationRecord ||
  mongoose.model<ICalibrationRecord>('CalibrationRecord', CalibrationRecordSchema)
