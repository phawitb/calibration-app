import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import User from '@/models/User'
import { cookies } from 'next/headers'

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

        await connectDB()
        const user = await User.findOne({ username })
        if (!user) return null

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null
        const normalizedRole = user.role === 'user' ? 'hospital_user' : user.role

        return {
          id: user._id.toString(),
          username: user.username,
          name: user.fullName || user.name,
          fullName: user.fullName || user.name,
          rank: user.rank || '',
          fullNameEn: user.fullNameEn || '',
          rankEn: user.rankEn || '',
          hospitalUnit: user.hospitalUnit || '',
          amedNo: user.amedNo || '',
          role: normalizedRole,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = (user as any).id
        token.username = (user as any).username
        token.fullName = (user as any).fullName
        token.rank = (user as any).rank
        token.fullNameEn = (user as any).fullNameEn
        token.rankEn = (user as any).rankEn
        token.hospitalUnit = (user as any).hospitalUnit
        token.amedNo = (user as any).amedNo
      }
      return token
    },
    async session({ session, token }) {
      if (!session.user) return session

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
        const role = impersonatedUser.role === 'user' ? 'hospital_user' : impersonatedUser.role
        ;(session.user as any).id = impersonatedUser._id.toString()
        ;(session.user as any).username = impersonatedUser.username
        ;(session.user as any).fullName = impersonatedUser.fullName || impersonatedUser.name
        ;(session.user as any).rank = impersonatedUser.rank || ''
        ;(session.user as any).fullNameEn = impersonatedUser.fullNameEn || ''
        ;(session.user as any).rankEn = impersonatedUser.rankEn || ''
        ;(session.user as any).hospitalUnit = impersonatedUser.hospitalUnit || ''
        ;(session.user as any).amedNo = impersonatedUser.amedNo || ''
        ;(session.user as any).role = role
        ;(session.user as any)._isImpersonating = true
        ;(session.user as any)._realAdminId = token.id
        session.user.name = impersonatedUser.fullName || impersonatedUser.name || ''
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
