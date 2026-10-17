import { headers as nextHeaders } from 'next/headers'
import { connectDB } from '@/lib/mongodb'
import UserActivity, { type ActivityAction } from '@/models/UserActivity'

type HeaderGetter = { get(name: string): string | null }
type HeaderSource = { headers: HeaderGetter } | HeaderGetter | null | undefined

type ActorLike = {
  id?: string
  username?: string
  role?: string
  _isImpersonating?: boolean
  _realAdminUsername?: string
} | null | undefined

export type ActivityExtra = {
  targetType?: string
  targetId?: unknown
  detail?: string
}

function headerGetter(source: HeaderSource): ((name: string) => string | null) | null {
  if (!source) return null
  const anySource = source as any
  if (typeof anySource.get === 'function') return (name) => anySource.get(name)
  if (anySource.headers && typeof anySource.headers.get === 'function') return (name) => anySource.headers.get(name)
  return null
}

/** headers ของ request ปัจจุบัน (ใช้ในที่ที่ไม่มี req เช่น NextAuth authorize) คืน null ถ้าเรียกนอก request */
export function currentRequestHeaders(): HeaderGetter | null {
  try { return nextHeaders() } catch { return null }
}

export function requestMeta(source: HeaderSource) {
  const get = headerGetter(source)
  if (!get) return { ip: '', userAgent: '' }
  const forwarded = String(get('x-forwarded-for') || '').split(',')[0].trim()
  const ip = forwarded || String(get('x-real-ip') || '').trim()
  const userAgent = String(get('user-agent') || '').slice(0, 300)
  return { ip, userAgent }
}

/**
 * บันทึกประวัติการใช้งาน ไม่ throw ไม่ว่ากรณีใด (ห้ามให้ log ทำให้งานหลักล้ม)
 * `actor` ใช้ session.user หรือ { username } สำหรับกรณี login ไม่สำเร็จ
 */
export async function logActivity(
  source: HeaderSource,
  actor: ActorLike,
  action: ActivityAction,
  extra: ActivityExtra = {},
): Promise<void> {
  try {
    const { ip, userAgent } = requestMeta(source)
    const username = String(actor?.username || '').trim() || '-'
    let detail = extra.detail ? String(extra.detail).slice(0, 1000) : undefined
    if (actor?._isImpersonating && actor._realAdminUsername) {
      detail = `[สวมสิทธิ์โดย ${actor._realAdminUsername}] ${detail || ''}`.trim()
    }
    await connectDB()
    await UserActivity.create({
      userId: actor?.id ? String(actor.id) : undefined,
      username,
      role: actor?.role ? String(actor.role) : undefined,
      action,
      targetType: extra.targetType,
      targetId: extra.targetId != null && extra.targetId !== '' ? String(extra.targetId) : undefined,
      detail,
      ip: ip || undefined,
      userAgent: userAgent || undefined,
    })
  } catch (err) {
    try { console.warn('[activityLog] failed:', (err as any)?.message || err) } catch { /* ignore */ }
  }
}
