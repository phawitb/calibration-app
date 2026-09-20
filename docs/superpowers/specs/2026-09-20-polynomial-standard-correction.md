# การชดเชยเครื่องมือมาตรฐานด้วย A B C D

ผู้ใช้ยืนยัน: x คือค่า Read ที่อ่านจากมาตรฐานแต่ละครั้ง และอนุญาตลบผลสอบเทียบเก่าเพื่อเริ่มใช้สูตรใหม่ทั้งหมด

## สูตรและข้อมูล
True = Read + (A*Read³ + B*Read² + C*Read + D)

เก็บ correctionModel: polynomial-v1 และ correctionA/B/C/D ในมาตรฐานรายปีและ snapshot ของรายการ คำนวณ True ของแต่ละ sample ก่อนเฉลี่ย เก็บ raw readings เดิม ไม่ใช้ nominal point แทน Read ไม่บวก Correction ซ้ำ ช่องว่างแตกต่างจาก 0 และต้องกรอกสัมประสิทธิ์ครบก่อนบันทึกปีหรือคำนวณ

ข้อมูลเดิมแปลงเป็น A=B=C=0, D=Correction เดิม เป็นค่าเริ่มต้นที่ให้ผลเทียบเท่า ไม่ใช่สัมประสิทธิ์ fitted ใหม่ เพิ่ม revision ของแต่ละปีโดยเก็บรุ่นเดิมและ PDF ไว้ การเพิ่มปีจากหน้าจอเว้น A–D เพื่อให้ผู้ใช้กรอก

## หน้ากรอกและผล
เปลี่ยนช่อง Correction คงที่เป็น A–D แสดง raw STD Read พร้อม Correction และ True ที่คำนวณอ่านอย่างเดียว ตามคำขอเพิ่มเติม การเลือกตารางเติม STD Read 1–4 จาก stdValues ของจุดนั้น หากไม่มีใช้ Cal. Point เป็นค่าเริ่มต้นที่แก้ไขได้ โดยยังไม่ชดเชย A–D และการแก้จุดไม่ทับค่าที่กรอกไว้ ค่า UUC ไม่ถูกชดเชยด้วยสมการของมาตรฐาน

SbCal ใช้ mean(STD True) - mean(UUC Read) เป็น Correction ของ UUC และ repeatability STD จากค่าหลังชดเชย ISO ใช้สมการเฉพาะช่องมาตรฐานของแต่ละวิธี รวม vertical/reference bath/IRJ และไม่บวก probe polynomial เดิมซ้ำ PDF ใช้ผลคำนวณร่วมกับหน้ากรอกข้อมูล

Check update เปลี่ยน snapshot และคำนวณใหม่จาก raw readings เดิม ไม่เขียนทับ readings ด้วยจุดเป้าหมาย คงเลขใบรับรองและสถานะเดิมเมื่อยืนยันอัปเดต

## การเริ่มใช้
สคริปต์ scripts/migrate-polynomial-standards.cjs ดูตัวอย่างเป็นค่าเริ่มต้น ต้องหยุดการเขียนจากแอปก่อนใช้ --apply --delete-old-results

ธุรกรรมเดียวเพิ่ม polynomial revisions, อัปเดต root standards, ล้าง calibrationrecords/archivedcertificatepdfs/amedcerthistories/certificaterevisions และคืน workorder reservations ตรวจจำนวนก่อนและหลัง เก็บทะเบียน ผู้ใช้ โรงพยาบาล เอกสารต้นฉบับ orders/config และ backup collections เดิม

## การตรวจสอบ
ทดสอบ cubic/nonlinear ต่อ sample, zero, negative, scientific notation, missing coefficients/overflow, ไม่มีการชดเชยซ้ำ, รักษา raw readings, Check update snapshots, UI annual/raw fields, PDF ที่สร้างจริง และ regression ISO ทั้ง 8 วิธี
