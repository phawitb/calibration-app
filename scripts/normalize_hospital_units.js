/* eslint-disable no-console */
require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')

function clean(v) {
  return String(v || '').trim()
}

function formatLabel(enRaw, thRaw) {
  const en = clean(enRaw)
  const th = clean(thRaw)
  if (en && th) return `${en}(${th})`
  return en || th
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI missing')
  await mongoose.connect(uri, { bufferCommands: false })
  const db = mongoose.connection.db
  if (!db) throw new Error('DB unavailable')

  const unitRows = await db.collection('unitnames')
    .find({}, { projection: { name: 1, thaiName: 1 } })
    .toArray()

  const map = new Map()
  for (const row of unitRows) {
    const en = clean(row.name)
    const th = clean(row.thaiName)
    const label = formatLabel(en, th)
    if (!label) continue
    for (const k of [en, th, label]) {
      const norm = clean(k).toLowerCase()
      if (norm) map.set(norm, label)
    }
  }

  const records = await db.collection('calibrationrecords')
    .find({}, { projection: { _id: 1, unitName: 1, location: 1 } })
    .toArray()

  let touchedRecords = 0
  for (const rec of records) {
    const unitName = clean(rec.unitName)
    const location = clean(rec.location)
    const nextUnit = unitName ? (map.get(unitName.toLowerCase()) || unitName) : unitName
    const nextLoc = location ? (map.get(location.toLowerCase()) || location) : location
    if (nextUnit !== unitName || nextLoc !== location) {
      await db.collection('calibrationrecords').updateOne(
        { _id: rec._id },
        { $set: { unitName: nextUnit, location: nextLoc } }
      )
      touchedRecords += 1
    }
  }

  const users = await db.collection('users')
    .find({}, { projection: { _id: 1, hospitalUnit: 1 } })
    .toArray()

  let touchedUsers = 0
  for (const user of users) {
    const hospitalUnit = clean(user.hospitalUnit)
    if (!hospitalUnit) continue
    const next = map.get(hospitalUnit.toLowerCase()) || hospitalUnit
    if (next !== hospitalUnit) {
      await db.collection('users').updateOne({ _id: user._id }, { $set: { hospitalUnit: next } })
      touchedUsers += 1
    }
  }

  console.log(`Normalized records: ${touchedRecords}`)
  console.log(`Normalized users: ${touchedUsers}`)
  await mongoose.disconnect()
}

main().catch(async (e) => {
  console.error(e)
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})
