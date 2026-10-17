/**
 * จำกัดจำนวนครั้งที่ล็อกอินผิดต่อชื่อผู้ใช้ (เก็บในหน่วยความจำของโปรเซส)
 * เหมาะกับการรันเครื่องเดียว/โลคอล ถ้า deploy หลาย instance ควรย้ายไป Redis หรือ DB
 */
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000

type Entry = { count: number; first: number; lockedUntil: number }

const store: Map<string, Entry> = (global as any).__loginRateLimit || new Map()
;(global as any).__loginRateLimit = store

function key(username: string) {
  return username.trim().toLowerCase()
}

/** คืนจำนวนวินาทีที่ยังถูกล็อก หรือ 0 ถ้าล็อกอินได้ */
export function loginLockedSeconds(username: string): number {
  const e = store.get(key(username))
  if (!e) return 0
  const now = Date.now()
  if (e.lockedUntil > now) return Math.ceil((e.lockedUntil - now) / 1000)
  if (now - e.first > WINDOW_MS) {
    store.delete(key(username))
  }
  return 0
}

export function recordLoginFailure(username: string) {
  const k = key(username)
  const now = Date.now()
  const e = store.get(k)
  if (!e || now - e.first > WINDOW_MS) {
    store.set(k, { count: 1, first: now, lockedUntil: 0 })
    return
  }
  e.count += 1
  if (e.count >= MAX_ATTEMPTS) e.lockedUntil = now + LOCK_MS
}

export function clearLoginFailures(username: string) {
  store.delete(key(username))
}
