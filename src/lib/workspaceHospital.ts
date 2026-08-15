export const WORKSPACE_HOSPITAL_COOKIE = 'workspace-hospital'
export const WORKSPACE_HOSPITAL_STORAGE = 'workspace-hospital'
export const WORKSPACE_SIDEBAR_STORAGE = 'workspace-sidebar-collapsed'

export function decodeWorkspaceHospital(raw?: string | null) {
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function writeWorkspaceHospitalCookie(hospital: string) {
  if (typeof document === 'undefined') return
  const value = encodeURIComponent(hospital)
  document.cookie = `${WORKSPACE_HOSPITAL_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
  try {
    if (hospital) localStorage.setItem(WORKSPACE_HOSPITAL_STORAGE, hospital)
    else localStorage.removeItem(WORKSPACE_HOSPITAL_STORAGE)
  } catch {
    /* ignore */
  }
}

export function readWorkspaceHospitalClient() {
  if (typeof document === 'undefined') return ''
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${WORKSPACE_HOSPITAL_COOKIE}=`))
  if (match) return decodeWorkspaceHospital(match.split('=').slice(1).join('='))
  try {
    return localStorage.getItem(WORKSPACE_HOSPITAL_STORAGE) || ''
  } catch {
    return ''
  }
}
