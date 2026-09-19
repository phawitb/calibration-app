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


## คำสั่งปฏิบัติงาน

เข้าสู่ระบบ → เลือกคำสั่ง → เลือกโรงพยาบาล → เลือกเครื่องมือเพื่อสร้างงานสอบเทียบ ทั้งระบบทั่วไปและ ISO งานใหม่ต้องเลือกเครื่องมือจากทะเบียนที่กำหนดไว้ในคำสั่ง

ที่ **จัดการระบบ → คำสั่ง** (`/admin?tab=orders`) ผู้ดูแลระบบและเจ้าหน้าที่สอบเทียบเพิ่ม/แก้ไขคำสั่ง เลือกหลายโรงพยาบาล เครื่องมือรายชิ้น และทีมจากบัญชีผู้ใช้ในระบบได้ แนบ PDF ได้หลายไฟล์ ขนาดสูงสุด 8 MB ต่อไฟล์ พร้อมเปิดดู ดาวน์โหลด และลบไฟล์

คำสั่งที่เริ่มสร้างงานสอบเทียบแล้วจะลบไม่ได้ และไม่สามารถนำเครื่องมือที่ใช้แล้วออกหรือย้ายโรงพยาบาลภายในคำสั่งได้ เพื่อรักษาข้อมูลอ้างอิง หากการสร้างงานถูกขัดจังหวะหลังเริ่มบันทึก ระบบจะคงการอ้างอิงไว้อย่างระมัดระวัง ประวัติเดิมยังดูได้ที่หน้าประวัติสอบเทียบ โดยเลือกโรงพยาบาลได้ตามสิทธิ์เดิม ผู้ใช้โรงพยาบาลเห็นเฉพาะส่วนของโรงพยาบาลตน และไม่เห็น PDF คำสั่งที่อาจครอบคลุมหลายโรงพยาบาล

ทดสอบคำสั่ง: `npm run test:work-orders` ต้องมี `mongod` ในเครื่อง คำสั่งนี้เริ่มฐานข้อมูลชั่วคราวเฉพาะการทดสอบและลบทิ้งเมื่อจบ ไม่ใช้ `.env.local`

การทดสอบ HTTP ใช้ฐานข้อมูลเฉพาะ `work_orders_e2e` ที่ `127.0.0.1:27028` และแอปทดสอบพอร์ต 3001 เท่านั้น เริ่ม MongoDB แยก แล้วรันแอปด้วย `MONGODB_URI=mongodb://127.0.0.1:27028/work_orders_e2e NEXTAUTH_SECRET=work-orders-local-test-secret-only NEXTAUTH_URL=http://localhost:3001 npm run dev -- --port 3001` จากนั้นใช้ `npm run test:work-orders:http` การทดสอบนี้สร้างข้อมูลจำลองและล้างเฉพาะฐานข้อมูลดังกล่าว ห้ามนำชื่อฐานข้อมูลหรือ secret สำหรับทดสอบไปใช้กับข้อมูลจริง
