import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from './mongodb'
import User from '@/models/User'

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
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role
        ;(session.user as any).id = token.id
        ;(session.user as any).username = token.username
        ;(session.user as any).fullName = token.fullName
        ;(session.user as any).rank = token.rank
        ;(session.user as any).fullNameEn = token.fullNameEn
        ;(session.user as any).rankEn = token.rankEn
        ;(session.user as any).hospitalUnit = token.hospitalUnit
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
