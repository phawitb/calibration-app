import CertificateTextConfig from '@/models/CertificateTextConfig'
import {defaultCertificateTexts} from '@/lib/certificateTexts'
export async function getCertificateTextConfig() {
  const config: any = await CertificateTextConfig.findOne({key: 'default'}).lean()
  return {texts: {...defaultCertificateTexts, ...config?.texts}, revision: config?.revision || 0}
}
