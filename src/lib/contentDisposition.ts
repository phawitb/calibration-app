const DEFAULT_FILE_NAME = 'certificate.pdf'

function encodeRfc5987(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

export function inlineContentDisposition(fileName: unknown) {
  const sanitized = String(fileName || DEFAULT_FILE_NAME)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim() || DEFAULT_FILE_NAME
  const asciiFallback = /^[\x20-\x7E]+$/.test(sanitized)
    ? sanitized.replace(/["\\]/g, '_')
    : DEFAULT_FILE_NAME

  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeRfc5987(sanitized)}`
}
