/** ชนิดไฟล์แนบที่ระบบรับ (เอกสารคำสั่ง, ใบรับรองบุคลากร): PDF และรูปภาพ PNG/JPEG (TOR 1.1.1.5, 1.1.1.10) */
export const ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number]
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024
/** ค่า accept ของ <input type="file"> */
export const ATTACHMENT_ACCEPT = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg'
export const ATTACHMENT_LABEL = 'PDF, PNG หรือ JPEG'
/** จำนวนไบต์ต้นไฟล์ที่ต้องอ่านเพื่อตรวจ magic bytes */
export const ATTACHMENT_SNIFF_BYTES = 8

/** ตรวจชนิดไฟล์จาก magic bytes (ไม่เชื่อ MIME ที่เบราว์เซอร์ส่งมา) */
export function sniffAttachmentType(bytes: Uint8Array): AttachmentType | null {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'application/pdf' // %PDF-
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

/** MIME ที่เบราว์เซอร์ส่งมาซึ่งถือว่าเข้ากันได้กับชนิดที่ตรวจพบ (image/jpg เป็นค่าที่พบในบางเบราว์เซอร์) */
export function declaredTypeMatches(declared: string, detected: AttachmentType) {
  const type = String(declared || '').toLowerCase()
  if (!type) return true
  if (detected === 'image/jpeg') return type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg'
  return type === detected
}

export function isImageAttachment(contentType: unknown) {
  return contentType === 'image/png' || contentType === 'image/jpeg'
}
