'use client'

import Link from 'next/link'
import { useState } from 'react'

/* ใช้ /logo.jpg (สำเนาเดียวกับ logo.jfif) — โหลดบน Vercel แน่กว่า next/image+จุล
 * รูปต้อง commit ทั้ง public/logo.jpg และ public/logo.jfif */
const LOGO_PREFERRED = '/logo.jpg'
const LOGO_FALLBACK = '/logo.jfif'
const ALT = 'กรมแพทย์ทหารบก'

function LogoImg({ className, priority }: { className: string; priority?: boolean }) {
  const [src, setSrc] = useState(LOGO_PREFERRED)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={ALT}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => {
        if (src !== LOGO_FALLBACK) setSrc(LOGO_FALLBACK)
      }}
    />
  )
}

export function SiteLogoLogin() {
  return (
    <div className="inline-flex items-center justify-center mb-4 rounded-2xl bg-white/10 border border-gold-400/50 p-3">
      <LogoImg
        priority
        className="h-28 w-auto max-w-[220px] object-contain max-h-32"
      />
    </div>
  )
}

export function SiteLogoHeader() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 sm:gap-3 shrink-0"
      title={ALT}
    >
      <LogoImg className="h-9 w-9 rounded-full object-cover max-h-10" />
      <span className="font-semibold text-sm hidden sm:inline leading-tight">ระบบสอบเทียบฯ</span>
    </Link>
  )
}
