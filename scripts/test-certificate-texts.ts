import test from 'node:test'
import assert from 'node:assert/strict'
import {CERTIFICATE_TEXT_FIELDS, certificateText, defaultCertificateTexts, validateCertificateTexts} from '../src/lib/certificateTexts'
test('text settings default to the original certificate and support explicit empty strings',()=>{
  const field = CERTIFICATE_TEXT_FIELDS.find(field=>field.defaultValue==='Calibration Certificate')!
  assert.equal(certificateText(field.defaultValue),field.defaultValue)
  assert.equal(certificateText(field.defaultValue,{[field.key]:'ใบรับรองการสอบเทียบ'}),'ใบรับรองการสอบเทียบ')
  assert.equal(certificateText(field.defaultValue,{[field.key]:''}),'')
  assert.deepEqual(validateCertificateTexts(defaultCertificateTexts),defaultCertificateTexts)
  assert.equal(new Set(CERTIFICATE_TEXT_FIELDS.map(field=>field.key)).size,CERTIFICATE_TEXT_FIELDS.length)
})
test('rejects invalid text and excess length, and ignores unknown configuration fields',()=>{
  const field=CERTIFICATE_TEXT_FIELDS[0]
  assert.throws(()=>validateCertificateTexts({[field.key]:'x'.repeat(field.maxLength+1)}))
  assert.throws(()=>validateCertificateTexts({[field.key]:32}))
  assert.throws(()=>validateCertificateTexts(null))
  assert.deepEqual(validateCertificateTexts({unknown:'ignored'}),{})
})
