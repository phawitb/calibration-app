'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { SiteLogoLogin } from '@/components/SiteLogo'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', {
      username, password, redirect: false,
    })
    setLoading(false)
    if (res?.ok) {
      toast.success('เข้าสู่ระบบสำเร็จ')
      router.push('/dashboard')
    } else {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-military-900 via-military-700 to-military-500">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      <div className="relative w-full max-w-md px-4">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <SiteLogoLogin />
          </div>
          <h1 className="text-2xl font-bold text-white">ระบบสอบเทียบเครื่องมือแพทย์</h1>
          <p className="text-military-200 text-sm mt-1">Medical Device Calibration System</p>
          <p className="text-gold-400 text-xs mt-1">กรมแพทย์ทหารบก</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-military-800 mb-6">เข้าสู่ระบบ</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-field"
                placeholder="กรอกชื่อผู้ใช้"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="กรอกรหัสผ่าน"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 py-3">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <p className="text-center text-military-200 text-xs mt-6">
          © {new Date().getFullYear()} กรมแพทย์ทหารบก · Calibration Management System
        </p>
      </div>
    </div>
  )
}
