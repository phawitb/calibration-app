export type StandardCoefficients = { a: number; b: number; c: number; d: number }
export const CORRECTION_FIELDS = ['correctionA', 'correctionB', 'correctionC', 'correctionD'] as const
export function hasPolynomialCorrection(std: any): boolean {
  return std?.correctionModel === 'polynomial-v1' || CORRECTION_FIELDS.some(key => std?.[key] !== undefined && std?.[key] !== null && std?.[key] !== '')
}
export function getStandardCoefficients(std: any): StandardCoefficients {
  if (!hasPolynomialCorrection(std)) {
    const d = std?.correction === '' || std?.correction == null ? 0 : Number(std.correction)
    if (!Number.isFinite(d)) throw new Error('ค่า Correction เดิมไม่ใช่ตัวเลข')
    return {a:0,b:0,c:0,d}
  }
  const values = CORRECTION_FIELDS.map((key, index) => {
    const value = std?.[key]
    if ((typeof value === 'string' && value.trim() === '') || value == null || !['string','number'].includes(typeof value) || !Number.isFinite(Number(value))) throw new Error(`กรุณาระบุสัมประสิทธิ์ ${'ABCD'[index]} ของเครื่องมือมาตรฐานให้ครบ`)
    return Number(value)
  })
  return {a:values[0],b:values[1],c:values[2],d:values[3]}
}
export function evaluateStandardCorrection(read: number, coefficients: StandardCoefficients) {
  if (!Number.isFinite(read)) throw new Error('ค่า Read ของเครื่องมือมาตรฐานไม่ถูกต้อง')
  const {a,b,c,d} = coefficients
  if (![a,b,c,d].every(Number.isFinite)) throw new Error('สัมประสิทธิ์ของเครื่องมือมาตรฐานไม่ถูกต้อง')
  const correction = ((a * read + b) * read + c) * read + d
  const trueValue = read + correction
  if (!Number.isFinite(correction) || !Number.isFinite(trueValue)) throw new Error('ผลการชดเชยเกินช่วงตัวเลขที่คำนวณได้')
  return {read,correction,trueValue}
}
export function correctStandardReading(read: number, std: any) {
  return evaluateStandardCorrection(read, getStandardCoefficients(std))
}
