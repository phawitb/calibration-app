export const PASSWORD_MIN_LENGTH = 8

/** คืนข้อความผิดพลาด หรือ null ถ้ารหัสผ่านผ่านเกณฑ์ */
export function passwordPolicyError(password: unknown): string | null {
  const pwd = typeof password === 'string' ? password : ''
  if (pwd.length < PASSWORD_MIN_LENGTH) {
    return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`
  }
  if (pwd.length > 128) return 'รหัสผ่านยาวเกินไป'
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) {
    return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข'
  }
  return null
}
