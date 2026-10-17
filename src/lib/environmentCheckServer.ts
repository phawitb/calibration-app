import CertNumberConfig from '@/models/CertNumberConfig'
import { assertEnvironmentForApproval, EnvironmentError, type EnvironmentConfig, type EnvironmentRecordLike } from '@/lib/environmentCheck'

/** โหลดเกณฑ์สภาวะแวดล้อมจากการตั้งค่าระบบ (ผู้เรียกต้องเชื่อมต่อฐานข้อมูลแล้ว) */
export async function loadEnvironmentConfig(): Promise<EnvironmentConfig | null> {
  const cfg = await CertNumberConfig.findOne({ key: 'default' })
    .select('requireEnvironment envTempMin envTempMax envHumidMin envHumidMax')
    .lean()
  return (cfg as EnvironmentConfig | null) || null
}

/**
 * คืนข้อความข้อผิดพลาดภาษาไทยเมื่อสภาวะแวดล้อมไม่ผ่านเกณฑ์ (ควรตอบ 409) หรือ null เมื่อผ่าน
 */
export async function environmentApprovalError(record: EnvironmentRecordLike | null | undefined): Promise<string | null> {
  try {
    assertEnvironmentForApproval(record, await loadEnvironmentConfig())
    return null
  } catch (error) {
    if (error instanceof EnvironmentError) return error.message
    throw error
  }
}
