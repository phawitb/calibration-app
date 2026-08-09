/**
 * Update AmedDevice records with toSelect, UC1-UC6, UcT from ArmedNo-UC.xlsx
 * Run: node scripts/seedAmedUC.js
 */
require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')
const XLSX = require('xlsx')
const path = require('path')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const AmedDeviceSchema = new mongoose.Schema({
  amedNo:       { type: String, required: true },
  unitName:     { type: String, required: true, index: true },
  section:      { type: String },
  deviceName:   { type: String },
  brand:        { type: String },
  model:        { type: String },
  serialNo:     { type: String },
  hpNumber:     { type: String },
  toSelect:     { type: Boolean, default: false },
  uc1:          { type: String },
  uc2:          { type: String },
  uc3:          { type: String },
  uc4:          { type: String },
  uc5:          { type: String },
  uc6:          { type: String },
  ucT:          { type: String },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true })
AmedDeviceSchema.index({ unitName: 1, amedNo: 1 }, { unique: true })

const AmedDevice = mongoose.model('AmedDevice', AmedDeviceSchema)

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  const xlsxPath = path.join(__dirname, '..', 'old-methods', 'ArmedNo-UC.xlsx')
  const wb = XLSX.readFile(xlsxPath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // Skip header row
  let updated = 0, notFound = 0, skipped = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const amedNo = row[0] != null ? String(row[0]).trim() : ''
    if (!amedNo) { skipped++; continue }

    const update = {
      toSelect: row[1] === true,
      uc1: row[2] != null ? String(row[2]) : undefined,
      uc2: row[3] != null ? String(row[3]) : undefined,
      uc3: row[4] != null ? String(row[4]) : undefined,
      uc4: row[5] != null ? String(row[5]) : undefined,
      uc5: row[6] != null ? String(row[6]) : undefined,
      uc6: row[7] != null ? String(row[7]) : undefined,
      ucT: row[8] != null ? String(row[8]) : undefined,
    }

    // Remove undefined fields
    for (const k of Object.keys(update)) {
      if (update[k] === undefined || update[k] === 'undefined' || update[k] === 'null') delete update[k]
    }

    const result = await AmedDevice.updateMany(
      { amedNo },
      { $set: update }
    )
    if (result.modifiedCount > 0) {
      updated += result.modifiedCount
    } else if (result.matchedCount === 0) {
      notFound++
    }
  }

  console.log(`Done. Updated: ${updated}, Not found: ${notFound}, Skipped: ${skipped}`)
  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
