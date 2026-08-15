type ClosestTarget = EventTarget & { closest?: (selector: string) => unknown }

export interface ReservedDocumentPopup {
  opener: unknown
  location: { href: string }
  close: () => void
}

type OpenDocumentPopup = (url: string, target: string) => ReservedDocumentPopup | null

interface CertificateListResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type LoadCertificateList = (url: string) => Promise<CertificateListResponse>

export function nextExpandedRecordId(currentId: string | null, clickedId: string) {
  return currentId === clickedId ? null : clickedId
}

export function isRecordRowActionTarget(target: EventTarget | null) {
  const closest = (target as ClosestTarget | null)?.closest
  return typeof closest === 'function'
    ? Boolean(closest.call(target, 'a, button, input, select, textarea, [data-row-action]'))
    : false
}

export function firstPersonnelCertificateUrl(userId: string, payload: unknown) {
  const data = (payload as { data?: Array<{ _id?: unknown }> } | null)?.data
  const certificateId = Array.isArray(data) ? data[0]?._id : null
  if (!userId || typeof certificateId !== 'string' || !certificateId) return null
  return `/api/users/${userId}/certificates/${certificateId}`
}

export function reserveDocumentPopup(openPopup: OpenDocumentPopup) {
  const popup = openPopup('', '_blank')
  if (popup) popup.opener = null
  return popup
}

export function navigateReservedDocumentPopup(popup: ReservedDocumentPopup, url: string) {
  popup.location.href = url
}

export function closeReservedDocumentPopup(popup: ReservedDocumentPopup) {
  popup.close()
}

export async function loadPersonnelCertificateIntoPopup(
  userId: string,
  popup: ReservedDocumentPopup,
  loadCertificateList: LoadCertificateList,
) {
  try {
    const response = await loadCertificateList(`/api/users/${userId}/certificates`)
    if (!response.ok) throw new Error(`certificate list request failed: ${response.status}`)

    const url = firstPersonnelCertificateUrl(userId, await response.json())
    if (!url) {
      closeReservedDocumentPopup(popup)
      return 'missing' as const
    }

    navigateReservedDocumentPopup(popup, url)
    return 'opened' as const
  } catch {
    closeReservedDocumentPopup(popup)
    return 'failed' as const
  }
}
