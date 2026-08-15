import assert from 'node:assert/strict'
import test from 'node:test'
import { inlineContentDisposition } from '../src/lib/contentDisposition'

test('encodes a Thai PDF filename as an RFC 5987 header value', () => {
  const header = inlineContentDisposition('ใบเซอร์ผู้สอบ.pdf')

  assert.equal(
    header,
    `inline; filename="certificate.pdf"; filename*=UTF-8''%E0%B9%83%E0%B8%9A%E0%B9%80%E0%B8%8B%E0%B8%AD%E0%B8%A3%E0%B9%8C%E0%B8%9C%E0%B8%B9%E0%B9%89%E0%B8%AA%E0%B8%AD%E0%B8%9A.pdf`,
  )
  assert.doesNotThrow(() => new Headers({ 'Content-Disposition': header }))
})

test('keeps a safe ASCII PDF filename readable', () => {
  assert.equal(
    inlineContentDisposition('technician-certificate.pdf'),
    `inline; filename="technician-certificate.pdf"; filename*=UTF-8''technician-certificate.pdf`,
  )
})

test('removes header delimiters from an uploaded filename', () => {
  const header = inlineContentDisposition('report.pdf\r\nX-Injected: yes')

  assert.equal(header.includes('\r'), false)
  assert.equal(header.includes('\n'), false)
  assert.doesNotThrow(() => new Headers({ 'Content-Disposition': header }))
})
