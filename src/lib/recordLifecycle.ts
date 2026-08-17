type DraftIdentity = {
  createdBy?: unknown
  unitName?: unknown
  calibrationType?: unknown
  amedNo?: unknown
  isoMethodCode?: unknown
}

const clean = (value: unknown) => String(value || '').trim()

export function buildUnsavedDraftQuery(input: DraftIdentity): Record<string, unknown> | null {
  const createdBy = clean(input.createdBy)
  const unitName = clean(input.unitName)
  const calibrationType = clean(input.calibrationType)
  if (!createdBy || !unitName || !['sbcal', 'iso'].includes(calibrationType)) return null

  const query: Record<string, unknown> = {
    createdBy,
    unitName,
    calibrationType,
  }
  if (calibrationType === 'sbcal') {
    const amedNo = clean(input.amedNo)
    if (!amedNo) return null
    query.amedNo = amedNo
  } else {
    const isoMethodCode = clean(input.isoMethodCode)
    if (!isoMethodCode) return null
    query.isoMethodCode = isoMethodCode
  }
  query.savedOnce = false
  return query
}

export function shouldAssignCertificateNumber(saveAction: string, certNo: unknown): boolean {
  return saveAction === 'request_approval' && !clean(certNo)
}

export function stripClientNumberFields<T extends Record<string, unknown>>(patch: T) {
  const safePatch = { ...patch }
  delete safePatch.certNo
  delete safePatch.amedCertKey
  return safePatch as Omit<T, 'certNo' | 'amedCertKey'>
}

export function withSavedRecords<T extends Record<string, unknown>>(scope: T) {
  return { ...scope, savedOnce: { $ne: false } }
}
