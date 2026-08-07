import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string
      fullName?: string
      rank?: string
      fullNameEn?: string
      rankEn?: string
      hospitalUnit?: string
      role?: 'admin' | 'hospital_user' | 'technician' | 'approver'
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    username?: string
    fullName?: string
    rank?: string
    fullNameEn?: string
    rankEn?: string
    hospitalUnit?: string
    role?: 'admin' | 'hospital_user' | 'technician' | 'approver'
  }
}
