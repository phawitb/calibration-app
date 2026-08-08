/**
 * Seed AmedDevice collection from Google Sheets data
 * Run: node scripts/seedAmedDevices.js
 */
require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const AmedDeviceSchema = new mongoose.Schema({
  amedNo:       { type: String, required: true },
  unitName:     { type: String, required: true, index: true },
  section:      { type: String },
  deviceName:   { type: String },
  deviceNameTh: { type: String },
  brand:        { type: String },
  model:        { type: String },
  serialNo:     { type: String },
  hpNumber:     { type: String },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true })
AmedDeviceSchema.index({ unitName: 1, amedNo: 1 }, { unique: true })

const AmedDevice = mongoose.model('AmedDevice', AmedDeviceSchema)

function clean(v) {
  if (!v || v === '-' || v === '""') return ''
  return v.trim()
}

const DATA = [
  { amedNo: '10801001', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Hygrometer with Probe', brand: 'Tbrand', model: 'Tmodel', serialNo: 'Ts/n', hpNumber: 'Thpnum' },
  { amedNo: '10801002', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Hygrometer with Probe', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10801003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Hygrometer with Probe', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10803001', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Hygrometer', brand: '', model: 'TA218', serialNo: '', hpNumber: '' },
  { amedNo: '10803002', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Hygrometer', brand: '', model: 'HTC-1', serialNo: '', hpNumber: '' },
  { amedNo: '10803003', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Hygrometer', brand: '', model: 'HTC-1', serialNo: '', hpNumber: '' },
  { amedNo: '10804001', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Incubator', brand: 'MEMMERT', model: 'UN75', serialNo: 'B317.0092', hpNumber: '' },
  { amedNo: '10804002', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Biomedical Refrigerator', brand: 'Sharp', model: '', serialNo: 'SJ-D33M', hpNumber: '' },
  { amedNo: '10804003', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Blood Bank Refrigerator', brand: 'Sanyo', model: 'MBR5060', serialNo: '30901360', hpNumber: '' },
  { amedNo: '10805001', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Incubator', brand: 'Digisystem', model: 'DSB-5000', serialNo: '14100068', hpNumber: '' },
  { amedNo: '10805002', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infrared Warmer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10805003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infrared Warmer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10806001', unitName: 'Fort Surasi Hospital', section: 'Central Sterile Supply Department (CSSD)', deviceName: 'Autoclave', brand: 'NAMWIWAT', model: 'A885P', serialNo: '2502121718', hpNumber: '' },
  { amedNo: '10806002', unitName: 'Fort Surasi Hospital', section: 'Central Sterile Supply Department (CSSD)', deviceName: 'Autoclave', brand: 'NAMWIWAT', model: 'A999-900L', serialNo: 'STP04-07180009', hpNumber: '' },
  { amedNo: '10806003', unitName: 'Fort Surasi Hospital', section: 'Central Sterile Supply Department (CSSD)', deviceName: 'Autoclave', brand: 'NAMWIWAT', model: 'A995P-600L', serialNo: 'STP01-06180006', hpNumber: '' },
  { amedNo: '10807001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Centrifuge', brand: 'MICROHEMATOCRIT', model: 'SH120-1', serialNo: '101090', hpNumber: '' },
  { amedNo: '10807002', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Centrifuge', brand: 'BOECO', model: 'C-28A', serialNo: '0002019-15', hpNumber: '' },
  { amedNo: '10807003', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Centrifuge', brand: 'BOECO', model: 'C-28A', serialNo: '0002018-05', hpNumber: '' },
  { amedNo: '10808001', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Shaker', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10808002', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Shaker', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10808003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Shaker', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10809001', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infrared Thermometer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10809002', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infrared Thermometer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10809003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infrared Thermometer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10810001', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Clinical Thermometer', brand: 'GENIAL', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10810002', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Clinical Thermometer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10810003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Clinical Thermometer', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10811001', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Mercury Sphygmomanometer', brand: 'HICO', model: 'SPHYGMO-MANOMETER', serialNo: '13027857', hpNumber: '' },
  { amedNo: '10811002', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Mercury Sphygmomanometer', brand: 'Riester', model: '', serialNo: '940348793', hpNumber: '' },
  { amedNo: '10811003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Mercury Sphygmomanometer', brand: 'Baumanometer', model: '', serialNo: 'FSSH-0120', hpNumber: '' },
  { amedNo: '10812001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Automatic Sphygmomanometer', brand: 'Omron', model: 'HEM-7130', serialNo: '20140811861VG', hpNumber: '' },
  { amedNo: '10812002', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Automatic Sphygmomanometer', brand: 'DINAMAP', model: 'Procare', serialNo: '2018918-001', hpNumber: '' },
  { amedNo: '10812003', unitName: 'Fort Surasi Hospital', section: 'PT', deviceName: 'Automatic Sphygmomanometer', brand: 'Omron', model: 'HEM-7203', serialNo: '20130405301VG', hpNumber: '' },
  { amedNo: '10813001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Patient Monitor', brand: 'Drager', model: 'Vista120', serialNo: 'V2SCL0032', hpNumber: '' },
  { amedNo: '10813002', unitName: 'Fort Surasi Hospital', section: 'Out-patient Department (OPD)', deviceName: 'Patient Monitor', brand: 'PHILIPS', model: 'G40E', serialNo: 'CN93916355', hpNumber: '' },
  { amedNo: '10813003', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Patient Monitor', brand: 'EDAN', model: 'IM70', serialNo: 'M19308250002', hpNumber: '' },
  { amedNo: '10814001', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Suction', brand: 'Medi-pump', model: 'Model 1132-2', serialNo: 'FSSH-0391', hpNumber: '' },
  { amedNo: '10814002', unitName: 'Fort Surasi Hospital', section: 'X-ray Room', deviceName: 'Suction', brand: 'FLAEM', model: 'Porta suction', serialNo: '13029025', hpNumber: '' },
  { amedNo: '10814003', unitName: 'Fort Surasi Hospital', section: 'Out-patient Department (OPD)', deviceName: 'Suction', brand: 'FLAEM', model: 'Port A Suction', serialNo: '16A2860112', hpNumber: '' },
  { amedNo: '10815001', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Electrocardiogram Recorder', brand: 'EDAN', model: 'SE1200 Express', serialNo: '460016-M21317210005', hpNumber: '' },
  { amedNo: '10815002', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Fetal Doppler', brand: 'Corometrics', model: '116', serialNo: '0116AAP06306937', hpNumber: '' },
  { amedNo: '10815003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Electrocardiogram Recorder', brand: 'EDAN', model: 'SE-1200', serialNo: 'M23616510010', hpNumber: '' },
  { amedNo: '10816001', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Defibrillator', brand: 'Philips', model: 'Heartstart XL', serialNo: 'US00126037', hpNumber: '' },
  { amedNo: '10816002', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Defibrillator', brand: 'Philips', model: '', serialNo: 'US00461080', hpNumber: '' },
  { amedNo: '10816003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Defibrillator', brand: 'Philips', model: 'Heartstart XL', serialNo: 'US00594267', hpNumber: '' },
  { amedNo: '10817001', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Electrical Muscle Stimulator', brand: 'ENRAF NONIUS', model: 'Endomed 482', serialNo: '34453', hpNumber: '' },
  { amedNo: '10817002', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrical Muscle Stimulator', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10817003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrical Muscle Stimulator', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10818001', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Hot Plate Boiler', brand: 'HYDROCOLLATOR', model: 'M-2', serialNo: '18767', hpNumber: '' },
  { amedNo: '10818002', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Hot Plate Boiler', brand: 'HOT PACK HEATER', model: '', serialNo: '77293V', hpNumber: '' },
  { amedNo: '10818003', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Parafin Bath', brand: 'ENRAF NONIUS', model: '', serialNo: '10-1758', hpNumber: '' },
  { amedNo: '10819001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Patient Warming System', brand: 'COVIDEN', model: 'WT6000', serialNo: 'SP15080528', hpNumber: '' },
  { amedNo: '10819002', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Patient Warming System', brand: '3M', model: '775', serialNo: '137129', hpNumber: '' },
  { amedNo: '10819003', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Patient Warming System', brand: 'Bair Hugger', model: '505', serialNo: '74899', hpNumber: '' },
  { amedNo: '10820001', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Infusion Pump', brand: 'B-BRAUN', model: 'Infusomat Space', serialNo: '417542', hpNumber: '' },
  { amedNo: '10820002', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Syringe Pump', brand: 'TERUMO', model: 'TE-SS700', serialNo: '1705010331', hpNumber: '' },
  { amedNo: '10820003', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Infusion Pump', brand: 'ENMIND', model: 'EN-V7 Smart', serialNo: '70210748307', hpNumber: '' },
  { amedNo: '10821001', unitName: 'Fort Surasi Hospital', section: 'Health Check Department', deviceName: 'Weighing Scale', brand: 'Tanita', model: 'Ha880', serialNo: '640200193', hpNumber: '' },
  { amedNo: '10821002', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Baby Weighing Scale', brand: 'ZEPPER', model: 'EB-20', serialNo: 'FSSH-0174', hpNumber: '' },
  { amedNo: '10821003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Baby Weighing Scale', brand: 'NAGATA', model: 'BW-0365', serialNo: 'F127204', hpNumber: '' },
  { amedNo: '10822001', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Flow Meter', brand: 'Harris', model: 'Model-861', serialNo: 'FSSH-0416', hpNumber: '' },
  { amedNo: '10822002', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Flow Meter', brand: 'Harris', model: 'Model-861', serialNo: 'FSSH-0413', hpNumber: '' },
  { amedNo: '10822003', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Flow Meter', brand: 'Harris', model: 'Model-861', serialNo: 'FSSH-0414', hpNumber: '' },
  { amedNo: '10823001', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Stopwatch', brand: 'Innotech', model: '', serialNo: '313044', hpNumber: '' },
  { amedNo: '10823002', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Stopwatch', brand: 'Canon', model: '', serialNo: '313041', hpNumber: '' },
  { amedNo: '10823003', unitName: 'Fort Surasi Hospital', section: 'Clinical Pathology Room', deviceName: 'Stopwatch', brand: 'hanhart', model: 'Labor 2', serialNo: '313009', hpNumber: '' },
  { amedNo: '10824001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Oxygen Saturation Meter (SpO2)', brand: 'NOVAMETRIX', model: 'OXYPLETH', serialNo: '77-20710', hpNumber: '' },
  { amedNo: '10824002', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Oxygen Saturation Meter (SpO2)', brand: 'SCHILLER', model: 'ARGUS OXM C', serialNo: 'HPA15J0196', hpNumber: '' },
  { amedNo: '10824003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Oxygen Saturation Meter (SpO2)', brand: 'SCHILLER', model: 'ARGUS OXM plus', serialNo: '13028980', hpNumber: '' },
  { amedNo: '10825001', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Electrosurgical Units', brand: 'COVIDEN', model: 'Force F1', serialNo: 'F1E67799A', hpNumber: '' },
  { amedNo: '10825002', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Electrosurgical Units', brand: 'COVIDEN', model: 'Force F1', serialNo: 'F1E67873A', hpNumber: '' },
  { amedNo: '10825003', unitName: 'Fort Surasi Hospital', section: 'Anesthesia Department', deviceName: 'Electrosurgical Units', brand: 'COVIDEN', model: 'Force F1', serialNo: 'F1E67822AX', hpNumber: '' },
  { amedNo: '10825004', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825005', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825006', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825007', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825008', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825009', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10825010', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Electrosurgical Units', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10826001', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Ventilator', brand: 'Weinmann', model: 'Medumat Standard A', serialNo: '8418', hpNumber: '' },
  { amedNo: '10826002', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Ventilator', brand: 'Weinmann', model: 'Medumat Standard A', serialNo: '8503', hpNumber: '' },
  { amedNo: '10826003', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Ventilator', brand: 'Weinmann', model: 'Medumat Standard A', serialNo: '8411', hpNumber: '' },
  { amedNo: '10827001', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Infant Incubator', brand: 'Atom Infant Incubator', model: 'V-80', serialNo: '8098557', hpNumber: '' },
  { amedNo: '10827002', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Infant Incubator', brand: '', model: 'C200', serialNo: 'WY29914', hpNumber: '' },
  { amedNo: '10827003', unitName: 'Fort Surasi Hospital', section: '', deviceName: 'Infant Incubator', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10828001', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Traction', brand: 'Ito-trac', model: 'tr-200', serialNo: '5195074', hpNumber: '' },
  { amedNo: '10828002', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Traction', brand: 'Triton', model: '7963', serialNo: '4446', hpNumber: '' },
  { amedNo: '10828003', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Traction', brand: 'ENRAF NONIUS', model: 'ELTRAC 471', serialNo: '3258', hpNumber: '' },
  { amedNo: '10829001', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Electrical Muscle Stimulator', brand: 'ENRAF NONIUS', model: 'SONOPULS 492', serialNo: '15792', hpNumber: '' },
  { amedNo: '10829002', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Therapeutic Ultrasound', brand: 'ENRAF NONIUS', model: 'SONOPULS 490', serialNo: '', hpNumber: '' },
  { amedNo: '10829003', unitName: 'Fort Surasi Hospital', section: 'Physical Therapy Department', deviceName: 'Therapeutic Ultrasound', brand: 'ITO', model: 'EU-941', serialNo: '201807160040', hpNumber: '' },
  { amedNo: '10830001', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Phototherapy lamp', brand: 'Mediprema', model: 'LEDDY BLOO', serialNo: '1971-0526', hpNumber: '' },
  { amedNo: '10830002', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Phototherapy lamp', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10830003', unitName: 'Fort Surasi Hospital', section: 'Private Room Ward', deviceName: 'Phototherapy lamp', brand: '', model: '', serialNo: '', hpNumber: '' },
  { amedNo: '10831001', unitName: 'Fort Surasi Hospital', section: 'Emergency Room (ER)', deviceName: 'Ultrasound-Guided Diagnosis', brand: 'Sonosite', model: 'EDGE II', serialNo: 'Q59B5B', hpNumber: '' },
  { amedNo: '10831002', unitName: 'Fort Surasi Hospital', section: 'X-ray Room', deviceName: 'Ultrasound-Guided Diagnosis', brand: 'PHILIPS', model: 'EPIQ5', serialNo: 'USN19C0494', hpNumber: '' },
  { amedNo: '10831003', unitName: 'Fort Surasi Hospital', section: 'Operating Room (OR)', deviceName: 'Ultrasound-Guided Diagnosis', brand: 'KONICA MINOLTA', model: 'SONIMAGC HSI', serialNo: '', hpNumber: '' },
]

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // Upsert each device
  let created = 0, updated = 0
  for (const d of DATA) {
    const result = await AmedDevice.findOneAndUpdate(
      { unitName: d.unitName, amedNo: d.amedNo },
      { $set: d },
      { upsert: true, new: true }
    )
    if (result.createdAt && result.updatedAt &&
        Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000) {
      created++
    } else {
      updated++
    }
  }

  console.log(`Done: ${created} created, ${updated} updated (total ${DATA.length})`)
  await mongoose.disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
