type ClosestTarget = EventTarget & { closest?: (selector: string) => unknown }

export function nextExpandedRecordId(currentId: string | null, clickedId: string) {
  return currentId === clickedId ? null : clickedId
}

export function isRecordRowActivationKey(key: string) {
  return key === 'Enter' || key === ' '
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
