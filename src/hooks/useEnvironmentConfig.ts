'use client'

import { useEffect, useState } from 'react'
import { ENVIRONMENT_DEFAULTS, resolveEnvironmentConfig, type ResolvedEnvironmentConfig } from '@/lib/environmentCheck'

/**
 * โหลดเกณฑ์สภาวะแวดล้อมจาก /api/admin/cert-config (admin/technician/approver)
 * ถ้าอ่านไม่ได้ (403 หรือ network) ใช้ค่าตั้งต้นระบบแทน
 */
export function useEnvironmentConfig(): ResolvedEnvironmentConfig {
  const [config, setConfig] = useState<ResolvedEnvironmentConfig>(ENVIRONMENT_DEFAULTS)
  useEffect(() => {
    let mounted = true
    fetch('/api/admin/cert-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (mounted && json?.config) setConfig(resolveEnvironmentConfig(json.config))
      })
      .catch(() => {
        // ใช้ค่าตั้งต้น
      })
    return () => {
      mounted = false
    }
  }, [])
  return config
}
