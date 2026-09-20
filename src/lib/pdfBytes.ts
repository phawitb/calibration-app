/** Lean MongoDB reads may return BSON Binary instead of a Node Buffer. */
export function pdfBytes(value: any): Buffer {
  if (Buffer.isBuffer(value)) return Buffer.from(value)
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value?.buffer instanceof Uint8Array) return Buffer.from(value.buffer)
  if (value?.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data)
  throw new Error('Invalid stored PDF data')
}
