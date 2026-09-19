export type NavigationSection = 'home' | 'add' | 'calibration' | 'admin'
export function navigationSection(pathname: string): NavigationSection | null {
  if (
    /^\/records\/[^/]+\/?$/.test(pathname) ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/hospital')
  )
    return 'add'
  if (pathname.startsWith('/records') || pathname.startsWith('/approvals'))
    return 'calibration'
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/reports'))
    return 'home'
  if (pathname.startsWith('/admin')) return 'admin'
  return null
}
export function mainNavigation(role?: string) {
  const manager = role === 'admin' || role === 'technician'
  return [
    { href: '/dashboard', label: 'หน้าหลัก', section: 'home' },
    ...(manager
      ? [{ href: '/records/new', label: 'เพิ่มข้อมูล', section: 'add' }]
      : []),
    { href: '/records', label: 'ประวัติสอบเทียบ', section: 'calibration' },
    ...(manager
      ? [{ href: '/admin?tab=data', label: 'จัดการระบบ', section: 'admin' }]
      : []),
  ]
}
