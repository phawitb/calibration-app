/**
 * MongoDB Seed Script
 * นำเข้าข้อมูลจาก Google Sheets → MongoDB
 *
 * วิธีใช้:
 *   node scripts/seed.js
 *
 * ต้องตั้ง MONGODB_URI ใน .env.local ก่อน
 */

require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const fs       = require('fs')
const path     = require('path')

// ─── Schemas ───────────────────────────────────────────────────────────────

const CalPointSchema = new mongoose.Schema({
  point:     mongoose.Schema.Types.Mixed,
  readings:  [Number],
  standards: [Number],
}, { _id: false })

const StdInstrumentSchema = new mongoose.Schema({
  no: String, name: String, manufacture: String, model: String,
  serialNo: String, certNo: String, measurement: String, unit: String,
  calDate: String, correction: Number, uTStd: Number, uTDrif: Number,
  uTResStd: Number, uTUuc: Number, uTInt: Number,
  tMin: Number, tMax: Number, hMin: Number, hMax: Number,
}, { _id: false })

const UcSchema = new mongoose.Schema({
  std:       StdInstrumentSchema,
  calPoints: [CalPointSchema],
}, { _id: false })

const CalibrationRecordSchema = new mongoose.Schema({
  sbNo: String, amedNo: String, select: Boolean, certNo: String,
  unitName: String, address: String, section: String,
  deviceName: String, brand: String, model: String, serialNo: String, hpNumber: String,
  issuedDate: mongoose.Schema.Types.Mixed,
  receivedN: String,
  receivedDate: mongoose.Schema.Types.Mixed,
  calDate: mongoose.Schema.Types.Mixed,
  location: String, lapTemp: Number, lapHumid: Number,
  calibrate: String, approve: String, calPrice: Number, mainPrice: Number,
  std1: StdInstrumentSchema,
  uc1: UcSchema, uc2: UcSchema, uc3: UcSchema,
  uc4: UcSchema, uc5: UcSchema, uc6: UcSchema, ucT: UcSchema,
  images: [String], remarks: [String], createdBy: String,
}, { timestamps: true })

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String, name: String,
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
}, { timestamps: true })

// Reference data schemas
const StdInstrumentRefSchema = new mongoose.Schema({
  no: String, name: String, manufacture: String, model: String,
  serialNo: String, certNo: String, measurement: String, unit: String,
  calDate: String, correction: Number, uTStd: Number, uTDrif: Number,
  uTResStd: Number, uTUuc: Number, uTInt: Number, expandedU: Number,
})

const DeviceNameSchema = new mongoose.Schema({
  no: Number, name: String, thaiName: String,
})

const UnitNameSchema = new mongoose.Schema({
  no: Number, unitId: String, name: String, thaiName: String, address: String,
})

const SectionNameSchema = new mongoose.Schema({
  no: Number, name: String, thaiName: String,
})

const CalNameSchema = new mongoose.Schema({
  no: Number, name: String, thaiName: String,
})

const CalPriceSchema = new mongoose.Schema({
  no: Number, calPrice: Number, mainPrice: Number, device: String,
})

const CalculationFormulaSchema = new mongoose.Schema({
  code: String, name: String, description: String,
  isDefault: Boolean, isActive: Boolean,
  confidenceLevel: Number, divisorNormal: Number,
  divisorRect: Number, numReadings: Number, forceK: Number,
}, { timestamps: true })

// ─── Models ────────────────────────────────────────────────────────────────

const CalibrationRecord = mongoose.model('CalibrationRecord', CalibrationRecordSchema)
const User              = mongoose.model('User', UserSchema)
const StdInstrumentRef  = mongoose.model('StdInstrumentRef', StdInstrumentRefSchema)
const DeviceName        = mongoose.model('DeviceName', DeviceNameSchema)
const UnitName          = mongoose.model('UnitName', UnitNameSchema)
const SectionName       = mongoose.model('SectionName', SectionNameSchema)
const CalName           = mongoose.model('CalName', CalNameSchema)
const CalPrice          = mongoose.model('CalPrice', CalPriceSchema)
const FormulaModel      = mongoose.models.CalculationFormula || mongoose.model('CalculationFormula', CalculationFormulaSchema)

// ─── Main seed function ────────────────────────────────────────────────────

async function seed() {
  console.log('🔌 Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Connected')

  // ── 1. Users ──────────────────────────────────────────────────────────────
  console.log('\n👤 Seeding users...')
  const userCount = await User.countDocuments()
  if (userCount === 0) {
    const hashed = await bcrypt.hash('admin1234', 10)
    await User.insertMany([
      { username: 'admin', password: hashed, name: 'ผู้ดูแลระบบ', role: 'admin' },
      { username: 'calibrate', password: await bcrypt.hash('cal1234', 10), name: 'สิบเอก เฉลิม ทองอิ่ม', role: 'user' },
    ])
    console.log('  ✅ Created 2 users: admin/admin1234, calibrate/cal1234')
  } else {
    console.log(`  ⏭  Skipped (${userCount} users exist)`)
  }

  // ── 2. Calibration Records ────────────────────────────────────────────────
  console.log('\n📋 Seeding calibration records...')
  const recCount = await CalibrationRecord.countDocuments()
  if (recCount === 0) {
    const dataPath = path.join(__dirname, 'calibration_data.json')
    if (!fs.existsSync(dataPath)) {
      console.log('  ⚠️  calibration_data.json not found — run python extraction first')
    } else {
      const records = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
      // Insert in batches of 50
      let inserted = 0
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50)
        await CalibrationRecord.insertMany(batch, { ordered: false })
        inserted += batch.length
        process.stdout.write(`\r  Inserted ${inserted}/${records.length}...`)
      }
      console.log(`\n  ✅ Inserted ${inserted} calibration records`)
    }
  } else {
    console.log(`  ⏭  Skipped (${recCount} records exist)`)
  }

  // ── 3. Reference data ─────────────────────────────────────────────────────
  const refPath = path.join(__dirname, 'ref_data.json')
  if (fs.existsSync(refPath)) {
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf-8'))
    console.log('\n📚 Seeding reference data...')

    // StdName
    if (await StdInstrumentRef.countDocuments() === 0) {
      const stdRows = ref.StdName?.slice(1).filter(r => r[1] && r[1] !== '') || []
      const stdDocs = stdRows.map(r => ({
        no: r[1], name: r[2], manufacture: r[3], model: r[4],
        serialNo: r[5], certNo: r[6], measurement: r[7], unit: r[8],
        calDate: r[9], correction: parseFloat(r[10])||0,
        uTStd: parseFloat(r[11])||0, uTDrif: parseFloat(r[12])||0,
        uTResStd: parseFloat(r[13])||0, uTUuc: parseFloat(r[14])||0,
        uTInt: parseFloat(r[15])||0, expandedU: parseFloat(r[16])||0,
      }))
      if (stdDocs.length) {
        await StdInstrumentRef.insertMany(stdDocs)
        console.log(`  ✅ StdInstrumentRef: ${stdDocs.length}`)
      }
    }

    // DeviceName
    if (await DeviceName.countDocuments() === 0) {
      const rows = ref.DeviceName?.slice(1).filter(r => r[1] && r[1] !== '') || []
      const docs = rows.map(r => ({ no: parseFloat(r[0])||0, name: r[1], thaiName: r[2] }))
      if (docs.length) { await DeviceName.insertMany(docs); console.log(`  ✅ DeviceName: ${docs.length}`) }
    }

    // UnitName
    if (await UnitName.countDocuments() === 0) {
      const rows = ref.UnitName?.slice(1).filter(r => r[2] && r[2] !== '') || []
      const docs = rows.map(r => ({ no: parseFloat(r[0])||0, unitId: r[1], name: r[2], thaiName: r[3], address: r[4] }))
      if (docs.length) { await UnitName.insertMany(docs); console.log(`  ✅ UnitName: ${docs.length}`) }
    }

    // SectionName
    if (await SectionName.countDocuments() === 0) {
      const rows = ref.Sectionname?.slice(1).filter(r => r[1] && r[1] !== '') || []
      const docs = rows.map(r => ({ no: parseFloat(r[0])||0, name: r[1].trim(), thaiName: r[2] }))
      if (docs.length) { await SectionName.insertMany(docs); console.log(`  ✅ SectionName: ${docs.length}`) }
    }

    // CalName
    if (await CalName.countDocuments() === 0) {
      const rows = ref.CalName?.slice(1).filter(r => r[1] && r[1] !== '') || []
      const docs = rows.map(r => ({ no: parseFloat(r[0])||0, name: r[1], thaiName: r[2] }))
      if (docs.length) { await CalName.insertMany(docs); console.log(`  ✅ CalName: ${docs.length}`) }
    }

    // CalPrice
    if (await CalPrice.countDocuments() === 0) {
      const rows = ref.CalPrice?.slice(1).filter(r => r[1] && r[1] !== '') || []
      const docs = rows.map(r => ({ no: parseFloat(r[0])||0, calPrice: parseFloat(r[1])||0, mainPrice: parseFloat(r[2])||0, device: r[3] }))
      if (docs.length) { await CalPrice.insertMany(docs); console.log(`  ✅ CalPrice: ${docs.length}`) }
    }
  } else {
    console.log('\n  ⚠️  ref_data.json not found — skipping reference data')
  }

  // ── 4. Calculation Formula ────────────────────────────────────────────────
  const formulaCount = await FormulaModel.countDocuments()
  if (formulaCount === 0) {
    await FormulaModel.create({
      code: 'standard',
      name: 'สูตรมาตรฐาน (95.45%)',
      description: 'สูตรมาตรฐานตาม GUM/JCGM 100:2008 ใช้กับ P12N, P123N, P123T, P12Time',
      isDefault: true,
      isActive: true,
      confidenceLevel: 0.9545,
      divisorNormal: 2,
      divisorRect: 1.732050808,
      numReadings: 4,
      forceK: null,
    })
    console.log('  ✅ CalculationFormula: สูตรมาตรฐาน')
  }

  console.log('\n🎉 Seeding complete!')
  await mongoose.disconnect()
}

seed().catch(err => { console.error('❌ Seed error:', err); process.exit(1) })
