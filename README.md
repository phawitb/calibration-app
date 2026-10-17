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
# หรือ: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET=your-random-secret-at-least-32-chars

# URL ของแอป
NEXTAUTH_URL=http://localhost:3000
```

### 4. Seed ข้อมูลเริ่มต้น

```bash
npm run seed
```

สร้างข้อมูลเริ่มต้น:
- **Users:** `admin` / `admin1234` (admin), `calibrate` / `cal1234` (technician)
  - รหัสผ่านตัวอย่างนี้ใช้สำหรับพัฒนาเท่านั้น **ให้เปลี่ยนทันทีก่อนใช้งานจริง** (รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข)
  - ล็อกอินผิด 5 ครั้งใน 15 นาที บัญชีจะถูกล็อกชั่วคราว 15 นาที
  - ไม่มี endpoint สร้าง admin อัตโนมัติ ต้องสร้างผู้ใช้แรกผ่าน `npm run seed` เท่านั้น
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

ในคำสั่งเลือก **เครื่องมือมาตรฐานที่นำไป** ได้หลายชิ้นจากทะเบียนเครื่องมือมาตรฐาน (ไม่บังคับ) เมื่อระบุแล้ว งานสอบเทียบที่สร้างภายใต้คำสั่งนั้นจะเลือกเครื่องมือมาตรฐาน (Std1 และ Uc1–UcT ของระบบทั่วไป, Standard Instrument ของ ISO) ได้เฉพาะรายการที่นำไป ทั้งในหน้าจอและการตรวจฝั่งเซิร์ฟเวอร์ คำสั่งที่ไม่ระบุจะใช้ได้ทั้งทะเบียน และเครื่องมือมาตรฐานที่มีงานในคำสั่งใช้แล้วจะนำออกจากคำสั่งไม่ได้ (เว้นแต่ล้างรายการทั้งหมดเพื่อเลิกจำกัด)

คำสั่งที่เริ่มสร้างงานสอบเทียบแล้วจะลบไม่ได้ และไม่สามารถนำเครื่องมือที่ใช้แล้วออกหรือย้ายโรงพยาบาลภายในคำสั่งได้ เพื่อรักษาข้อมูลอ้างอิง หากการสร้างงานถูกขัดจังหวะหลังเริ่มบันทึก ระบบจะคงการอ้างอิงไว้อย่างระมัดระวัง ประวัติเดิมยังดูได้ที่หน้าประวัติสอบเทียบ โดยเลือกโรงพยาบาลได้ตามสิทธิ์เดิม ผู้ใช้โรงพยาบาลเห็นเฉพาะส่วนของโรงพยาบาลตน และไม่เห็น PDF คำสั่งที่อาจครอบคลุมหลายโรงพยาบาล

ทดสอบคำสั่ง: `npm run test:work-orders` ต้องมี `mongod` ในเครื่อง คำสั่งนี้เริ่มฐานข้อมูลชั่วคราวเฉพาะการทดสอบและลบทิ้งเมื่อจบ ไม่ใช้ `.env.local`

การทดสอบ HTTP ใช้ฐานข้อมูลเฉพาะ `work_orders_e2e` ที่ `127.0.0.1:27028` และแอปทดสอบพอร์ต 3001 เท่านั้น เริ่ม MongoDB แยก แล้วรันแอปด้วย `MONGODB_URI=mongodb://127.0.0.1:27028/work_orders_e2e NEXTAUTH_SECRET=work-orders-local-test-secret-only NEXTAUTH_URL=http://localhost:3001 npm run dev -- --port 3001` จากนั้นใช้ `npm run test:work-orders:http` การทดสอบนี้สร้างข้อมูลจำลองและล้างเฉพาะฐานข้อมูลดังกล่าว ห้ามนำชื่อฐานข้อมูลหรือ secret สำหรับทดสอบไปใช้กับข้อมูลจริง

---

## v2: ส่วนที่เพิ่มตามรายละเอียดประกอบการจ้าง (TOR)

### รายงานและการส่งออก
- **ส่งออก Excel** ได้ที่หน้าประวัติสอบเทียบ (`/api/export/records` ใช้ตัวกรองเดียวกับหน้าจอ), หน้าโรงพยาบาล (`/api/export/devices?unitName=`), หน้ารายงานสรุป (`/api/reports/summary?format=xlsx`) และรายงานตามแบบฟอร์ม
- **รายงานตามแบบฟอร์ม TOR** ที่ `/reports/tables` (API `/api/reports/tor?type=...&year=พ.ศ.&unitName=&deviceName=&format=json|xlsx`) 5 แบบ: `unit` รายงานผลสำหรับหน่วยรับบริการ, `yearly` รายงานผลรวมประจำปี, `savings` รายงานลดค่าใช้จ่ายรายหน่วย, `savings-yearly` สรุปรายปี, `standards` เครื่องมือมาตรฐานประจำห้องปฏิบัติการ พร้อมปุ่มพิมพ์/PDF (A4 แนวนอน) นับเฉพาะรายการที่อนุมัติแล้ว เว้นแต่ระบุ `status=all`
- Dashboard เพิ่มสรุปแยกโรงพยาบาล ประเภทเครื่องมือ ปี พ.ศ. วิธีสอบเทียบ และจำนวนเครื่องต่อหน่วยงาน

### เครื่องมือมาตรฐาน
- ทะเบียน (`stdinstrumentrefs`) เพิ่ม `calIntervalMonths` (ความถี่), `nextCalDate` (คำนวณอัตโนมัติจากวันที่สอบเทียบล่าสุด + ความถี่ จนกว่าจะกำหนดเอง), `calibratedBy` (หน่วยงานที่สอบเทียบ), `acceptanceCriteria` { maxCorrection, maxUncertainty, note }
- ระบบประเมินค่าแก้และค่าความไม่แน่นอนของแต่ละปีกับเกณฑ์ แสดงป้าย ผ่าน/ไม่ผ่านเกณฑ์ และแจ้งเตือนที่ Navbar เมื่อเครื่องมือมาตรฐานใกล้ครบกำหนด เกินกำหนด หรือไม่ผ่านเกณฑ์ (`/api/alerts/standards`, admin/technician)

### คุณภาพผลการสอบเทียบ
- **เกณฑ์การยอมรับ (MPE)** ต่อรายการ (`acceptance.mpe`, `mpeUnit` abs/percent, `includeUncertainty`) ค่าเริ่มต้นดึงจากตารางราคา (`calprices.mpe`, `mpeUnit`) ตามชื่อเครื่องมือ ระบบตัดสิน **ผ่าน / ไม่ผ่าน / N/A** ต่อจุดสอบเทียบและผลรวม แสดงในใบรับรอง ผู้ใช้แก้ผลเองได้ผ่าน `PUT /api/records/[id]/verdict`
- **สภาวะแวดล้อมก่อนอนุมัติ** ตั้งค่าที่จัดการรูปแบบเลขใบรับรอง (`requireEnvironment`, ช่วงอุณหภูมิ/ความชื้น) ถ้าค่าที่บันทึกขาดหรืออยู่นอกช่วงของเครื่องมือมาตรฐานสภาพแวดล้อม (หรือค่าตั้งต้นของระบบ) จะส่งขออนุมัติและอนุมัติไม่ได้
- **ประเภทงาน** `serviceType` สอบเทียบ/ทดสอบ และ `electricalSafetyTest` แสดงบนหัวใบรับรอง
- บันทึกอัตโนมัติทุก 20 วินาทีหลังแก้ไข สำหรับรายการสถานะร่าง/ตีกลับ

### ความปลอดภัยและการตรวจสอบ
- **PIN ยืนยันส่งอนุมัติ** ผู้ใช้ตั้งที่หน้าโปรไฟล์ (`/api/me/pin`) ทุกคนรวม admin ต้องกรอก PIN เมื่อส่งขออนุมัติ
- **สิทธิ์เจ้าของรายการ** technician แก้ไข/บันทึกขั้นตอนได้เฉพาะรายการที่ตนสร้างหรือเป็นผู้สอบเทียบ admin แก้ได้ทั้งหมด
- **ประวัติการใช้งาน** (`useractivities`, เก็บ 10 ปี) บันทึกล็อกอินสำเร็จ/ล้มเหลว ออกจากระบบ สวมสิทธิ์ สร้าง/แก้/ลบ/ส่งอนุมัติ/อนุมัติ/ตีกลับรายการ จัดการผู้ใช้ และดาวน์โหลดใบรับรอง ดูได้ที่ จัดการระบบ → ประวัติการใช้งาน (admin)
- **ไฟล์แนบต่อรายการ** ผลสอบเทียบจากภายนอกและเอกสารอื่น (PDF/PNG/JPEG ≤ 8 MB) ที่แท็บ "ผลสอบเทียบภายนอก / ไฟล์แนบ" (`/api/records/[id]/attachments`) รวมในดาวน์โหลดทั้งชุด
- ใบรับรองบุคลากรและเอกสารคำสั่งรองรับรูปภาพ PNG/JPEG นอกจาก PDF ตรวจชนิดไฟล์จาก magic bytes
- ผู้ใช้มีฟิลด์ตำแหน่ง (`position`)

### อื่นๆ
- เพิ่มเครื่องมือโดยไม่ระบุ AmedNo ระบบออกรหัส `AUTO-<พ.ศ.>-NNNN` ให้อัตโนมัติ
- เทสต์เพิ่ม: `npm run test:acceptance`

### ข้อที่ยังไม่ครอบคลุม (ต้องตกลงขอบเขตกับกรรมการ)
- จำนวนโมเดลคำนวณและแบบฟอร์มใบรับรอง ≥ 80 รูปแบบ (ปัจจุบันแบบทั่วไป 1 + ISO 8 วิธี + สูตรปรับตัวหารได้)
- ฐานข้อมูลเชิงสัมพันธ์ MySQL/PostgreSQL (ระบบใช้ MongoDB ซึ่ง TOR ข้อ 1 อนุญาต)
- ระบบจัดการเนื้อหาเว็บไซต์ (CMS) ทั่วไป
