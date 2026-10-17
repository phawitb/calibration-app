import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import User from '@/models/User'
import { cookies } from 'next/headers'
import { clearLoginFailures, loginLockedSeconds, recordLoginFailure } from './loginRateLimit'
import { currentRequestHeaders, logActivity } from './activityLog'

/** รีเฟรช role/หน่วยงาน/สถานะบัญชี จาก DB ลง JWT ทุก ๆ ช่วงเวลานี้ */
const TOKEN_REFRESH_MS = 60 * 1000

function normalizeRole(role: unknown) {
  return role === 'user' ? 'hospital_user' : String(role || '')
}

function userToTokenFields(user: any) {
  return {
    role: normalizeRole(user.role),
    id: String(user._id),
    username: user.username,
    fullName: user.fullName || user.name,
    rank: user.rank || '',
    fullNameEn: user.fullNameEn || '',
    rankEn: user.rankEn || '',
    position: user.position || '',
    hospitalUnit: user.hospitalUnit || '',
    amedNo: user.amedNo || '',
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const username = credentials.username.trim()
        if (!username) return null

        const lockedFor = loginLockedSeconds(username)
        if (lockedFor > 0) {
          throw new Error(`ล็อกอินผิดหลายครั้ง กรุณารอ ${Math.ceil(lockedFor / 60)} นาที`)
        }

        await connectDB()
        const user = await User.findOne({ username })
        if (!user) {
          recordLoginFailure(username)
          await logActivity(currentRequestHeaders(), { username }, 'login_failure', { detail: 'ไม่พบชื่อผู้ใช้' })
          return null
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          recordLoginFailure(username)
          await logActivity(currentRequestHeaders(), { id: String(user._id), username, role: normalizeRole(user.role) }, 'login_failure', { detail: 'รหัสผ่านไม่ถูกต้อง' })
          return null
        }
        if (user.isActive === false) {
          throw new Error('บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
        }
        clearLoginFailures(username)
        await logActivity(currentRequestHeaders(), { id: String(user._id), username, role: normalizeRole(user.role) }, 'login_success')

        const fields = userToTokenFields(user)
        return {
          ...fields,
          name: fields.fullName,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        Object.assign(token, userToTokenFields({ ...(user as any), _id: (user as any).id }))
        token.refreshedAt = Date.now()
        token.disabled = false
        return token
      }

      // ดึง role / หน่วยงาน / สถานะบัญชี ล่าสุดจาก DB เป็นระยะ
      const last = Number(token.refreshedAt || 0)
      if (token.id && Date.now() - last > TOKEN_REFRESH_MS) {
        try {
          await connectDB()
          const fresh = await User.findById(token.id as string)
            .select('username name fullName rank fullNameEn rankEn position role hospitalUnit amedNo isActive')
            .lean()
          if (!fresh || (fresh as any).isActive === false) {
            token.disabled = true
          } else {
            Object.assign(token, userToTokenFields(fresh))
            token.disabled = false
          }
          token.refreshedAt = Date.now()
        } catch {
          // DB ล่มชั่วคราว ใช้ค่าเดิมใน token ต่อไป
        }
      }
      return token
    },
    async session({ session, token }) {
      if (!session.user) return session
      // บัญชีถูกปิดหรือถูกลบ → ไม่มี session
      if (token.disabled) return null as any

      // Check for impersonation cookie (admin only)
      let impersonatedUser: any = null
      if (token.role === 'admin') {
        try {
          const cookieStore = await cookies()
          const impCookie = cookieStore.get('impersonate_user_id')
          if (impCookie?.value) {
            await connectDB()
            const target = await User.findById(impCookie.value).lean()
            if (target) impersonatedUser = target
          }
        } catch {
          // cookies() may fail in some contexts, ignore
        }
      }

      if (impersonatedUser) {
        // Override session with impersonated user data
        const fields = userToTokenFields(impersonatedUser)
        Object.assign(session.user as any, fields)
        ;(session.user as any)._isImpersonating = true
        ;(session.user as any)._realAdminId = token.id
        ;(session.user as any)._realAdminUsername = token.username
        session.user.name = fields.fullName || ''
      } else {
        ;(session.user as any).role = token.role
        ;(session.user as any).id = token.id
        ;(session.user as any).username = token.username
        ;(session.user as any).fullName = token.fullName
        ;(session.user as any).rank = token.rank
        ;(session.user as any).fullNameEn = token.fullNameEn
        ;(session.user as any).rankEn = token.rankEn
        ;(session.user as any).hospitalUnit = token.hospitalUnit
        ;(session.user as any).amedNo = token.amedNo
        if (token.fullName) session.user.name = token.fullName as string
      }

      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
}
