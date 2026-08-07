# ระบบสอบเทียบเครื่องมือแพทย์ (Calibration App)

Medical Device Calibration System

| Stack | Technology |
|-------|------------|
| Frontend | React 18, Next.js 14 (App Router), Tailwind CSS |
| Backend | Next.js API Routes |
| Database | MongoDB (Atlas / self-hosted) + Mongoose |
| Auth | NextAuth v4 (Credentials) |
| PDF | @react-pdf/renderer |

---

## ความต้องการของระบบ (Prerequisites)

- **Node.js** >= 18
- **MongoDB** (เลือกอย่างใดอย่างหนึ่ง)
  - MongoDB Atlas (cloud) - แนะนำสำหรับ production
  - MongoDB Community (local) - สำหรับ development

---

## การติดตั้ง (Installation)

### 1. Clone โปรเจค

```bash
git clone https://github.com/phawitb/calibration-app.git
cd calibration-app
```

### 2. ติดตั้ง dependencies

```bash
npm install
```

### 3. ตั้งค่า Environment Variables

```bash
cp .env.example .env.local
```

แก้ไขไฟล์ `.env.local`:

```env
# MongoDB Connection String
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/calibration_db
# หรือใช้ local: mongodb://localhost:27017/calibration_db

# สร้างด้วย: openssl rand -base64 32
NEXTAUTH_SECRET=your-random-secret-at-least-32-chars

# URL ของแอป
NEXTAUTH_URL=http://localhost:3000
```

### 4. Seed ข้อมูลเริ่มต้น

```bash
npm run seed
```

สร้างข้อมูลเริ่มต้น:
- **Users:** `admin` / `admin1234` (admin), `calibrate` / `cal1234` (user)
- **Reference data:** เครื่องมือมาตรฐาน, หน่วยงาน, แผนก, ราคา ฯลฯ
- **Calibration records:** ข้อมูลตัวอย่าง 103 รายการ

### 5. รันแอป

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

เปิดเบราว์เซอร์ที่ http://localhost:3000

---

## Deploy บน Server (Production)

### ตัวเลือก A: Vercel (แนะนำ)

1. เชื่อมต่อ GitHub repo กับ Vercel
2. ตั้ง Environment Variables ใน Vercel Dashboard:
   - `MONGODB_URI` - connection string ของ MongoDB Atlas
   - `NEXTAUTH_SECRET` - random string 32+ chars
   - `NEXTAUTH_URL` - URL ของแอปบน Vercel (เช่น `https://calibration-app.vercel.app`)
3. Deploy อัตโนมัติเมื่อ push code

หรือใช้ CLI:
```bash
npm run vercel:prod
```

### ตัวเลือก B: Self-hosted (VPS / On-premise)

```bash
git clone https://github.com/phawitb/calibration-app.git
cd calibration-app
npm install
cp .env.example .env.local
# แก้ไข .env.local ตามเซิร์ฟเวอร์

npm run seed    # ครั้งแรกเท่านั้น
npm run build
npm start       # รันที่ port 3000
```

ใช้ **PM2** เพื่อให้แอปรันตลอด:
```bash
npm install -g pm2
pm2 start npm --name "calibration-app" -- start
pm2 save
pm2 startup
```

---

## หมายเหตุ MongoDB Atlas

- ต้องเพิ่ม IP ของ server ใน **Network Access** > **Add IP Address**
- สำหรับ Vercel ใช้ `0.0.0.0/0` (Allow Access from Anywhere)

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `npm run dev` | รัน development server |
| `npm run build` | Build สำหรับ production |
| `npm start` | รัน production server |
| `npm run seed` | นำเข้าข้อมูลเริ่มต้น |
| `npm run dev:clean` | ล้าง cache แล้วรัน dev |
