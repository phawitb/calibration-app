/**
 * Seed demo users: delete all existing, create 2 per role with signatures
 * Run: node scripts/seedUsers.js
 */
require('dotenv').config({ path: '.env.local' })
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { createCanvas } = require('canvas')

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1) }

const UserSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  name:         { type: String, required: true },
  fullName:     { type: String },
  rank:         { type: String },
  fullNameEn:   { type: String },
  rankEn:       { type: String },
  role:         { type: String, enum: ['admin', 'hospital_user', 'technician', 'approver'], default: 'hospital_user' },
  hospitalUnit: { type: String },
  amedNo:       { type: String },
  signaturePng: { type: String },
  isActive:     { type: Boolean, default: true },
  createdAt:    { type: Date, default: Date.now },
})
const User = mongoose.model('User', UserSchema)

/**
 * Generate a handwriting-style signature image as PNG data URL
 */
function generateSignature(name) {
  const width = 300, height = 100
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // Transparent background
  ctx.clearRect(0, 0, width, height)

  // Dark blue ink
  ctx.strokeStyle = '#1a237e'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const seed = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rng = mulberry32(seed)

  // Draw signature-like strokes
  const numStrokes = 3 + Math.floor(rng() * 3)
  let x = 30 + rng() * 20
  let y = 40 + rng() * 20

  for (let s = 0; s < numStrokes; s++) {
    ctx.beginPath()
    ctx.moveTo(x, y)

    const points = 4 + Math.floor(rng() * 5)
    for (let p = 0; p < points; p++) {
      const cpx1 = x + 15 + rng() * 30
      const cpy1 = y - 20 + rng() * 40
      const cpx2 = cpx1 + 10 + rng() * 20
      const cpy2 = y - 15 + rng() * 30
      x = cpx2 + 5 + rng() * 15
      y = 35 + rng() * 30
      ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y)
    }
    ctx.stroke()

    x += 5 + rng() * 10
    y = 40 + rng() * 20
  }

  // Underline
  ctx.beginPath()
  ctx.lineWidth = 1.5
  ctx.moveTo(25, 75 + rng() * 10)
  const endX = Math.min(x + 20, width - 20)
  ctx.bezierCurveTo(
    endX * 0.3, 78 + rng() * 5,
    endX * 0.6, 72 + rng() * 8,
    endX, 75 + rng() * 5
  )
  ctx.stroke()

  return canvas.toDataURL('image/png')
}

// Simple seeded PRNG
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const USERS = [
  // Admin x2
  {
    username: 'admin1',
    password: 'admin1234',
    name: 'สมชาย',
    fullName: 'พ.อ. สมชาย วงศ์ประเสริฐ',
    rank: 'พ.อ.',
    fullNameEn: 'Col. Somchai Wongprasert',
    rankEn: 'Col.',
    role: 'admin',
  },
  {
    username: 'admin2',
    password: 'admin1234',
    name: 'วิภาดา',
    fullName: 'พ.ท.หญิง วิภาดา ศรีสุวรรณ',
    rank: 'พ.ท.หญิง',
    fullNameEn: 'Lt.Col. Wipada Srisuwan',
    rankEn: 'Lt.Col.',
    role: 'admin',
  },
  // Technician x2
  {
    username: 'tech1',
    password: 'tech1234',
    name: 'ธนพล',
    fullName: 'ร.อ. ธนพล จันทร์เพ็ญ',
    rank: 'ร.อ.',
    fullNameEn: 'Capt. Thanaphon Chanpen',
    rankEn: 'Capt.',
    role: 'technician',
  },
  {
    username: 'tech2',
    password: 'tech1234',
    name: 'ปิยะนุช',
    fullName: 'ร.ท.หญิง ปิยะนุช แก้วมณี',
    rank: 'ร.ท.หญิง',
    fullNameEn: 'Lt. Piyanuch Kaewmanee',
    rankEn: 'Lt.',
    role: 'technician',
  },
  // Approver x2
  {
    username: 'approver1',
    password: 'approver1234',
    name: 'ประสิทธิ์',
    fullName: 'พ.อ. ประสิทธิ์ รัตนโชติ',
    rank: 'พ.อ.',
    fullNameEn: 'Col. Prasit Rattanachot',
    rankEn: 'Col.',
    role: 'approver',
  },
  {
    username: 'approver2',
    password: 'approver1234',
    name: 'สุนิสา',
    fullName: 'พ.ท.หญิง สุนิสา เกตุแก้ว',
    rank: 'พ.ท.หญิง',
    fullNameEn: 'Lt.Col. Sunisa Ketkaew',
    rankEn: 'Lt.Col.',
    role: 'approver',
  },
  // Hospital user x2
  {
    username: 'hospital1',
    password: 'hospital1234',
    name: 'กิตติพงษ์',
    fullName: 'ร.อ. กิตติพงษ์ สุขสวัสดิ์',
    rank: 'ร.อ.',
    fullNameEn: 'Capt. Kittipong Suksawat',
    rankEn: 'Capt.',
    role: 'hospital_user',
    hospitalUnit: 'รพ.อ.ปร.',
  },
  {
    username: 'hospital2',
    password: 'hospital1234',
    name: 'นภัสสร',
    fullName: 'ร.ท.หญิง นภัสสร พิทักษ์ธรรม',
    rank: 'ร.ท.หญิง',
    fullNameEn: 'Lt. Napassorn Pitaktham',
    rankEn: 'Lt.',
    role: 'hospital_user',
    hospitalUnit: 'รพ.รร.จปร.',
  },
]

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // Delete all existing users
  const deleted = await User.deleteMany({})
  console.log(`Deleted ${deleted.deletedCount} existing users`)

  // Create new users
  for (const u of USERS) {
    const hashed = await bcrypt.hash(u.password, 10)
    const needSig = ['technician', 'approver'].includes(u.role)
    const sig = needSig ? generateSignature(u.fullName) : undefined

    await User.create({
      username: u.username,
      password: hashed,
      name: u.name,
      fullName: u.fullName,
      rank: u.rank || '',
      fullNameEn: u.fullNameEn || '',
      rankEn: u.rankEn || '',
      role: u.role,
      hospitalUnit: u.hospitalUnit || '',
      signaturePng: sig,
      isActive: true,
    })
    console.log(`Created: ${u.username} (${u.role}) - ${u.fullName}${needSig ? ' [+signature]' : ''}`)
  }

  console.log('\nDone! All users:')
  console.log('─'.repeat(60))
  console.log('Username      | Password       | Role           | Name')
  console.log('─'.repeat(60))
  for (const u of USERS) {
    console.log(`${u.username.padEnd(13)} | ${u.password.padEnd(14)} | ${u.role.padEnd(14)} | ${u.fullName}`)
  }

  await mongoose.disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
