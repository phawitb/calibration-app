export type UnitRefLike = {
  name?: string
  thaiName?: string
}

function clean(v: unknown) {
  return String(v ?? '').trim()
}

export function formatHospitalUnitLabel(enRaw?: string, thRaw?: string) {
  const en = clean(enRaw)
  const th = clean(thRaw)
  if (en && th) return `${en}(${th})`
  return en || th
}

export function buildHospitalUnitOptions(units: UnitRefLike[]) {
  return Array.from(
    new Set(units.map((u) => formatHospitalUnitLabel(u?.name, u?.thaiName)).filter(Boolean))
  )
}

export function normalizeHospitalUnitFromRefs(inputRaw: unknown, units: UnitRefLike[]) {
  const input = clean(inputRaw)
  if (!input) return ''
  const norm = input.toLowerCase()
  for (const u of units) {
    const en = clean(u?.name)
    const th = clean(u?.thaiName)
    const label = formatHospitalUnitLabel(en, th)
    const keys = [en, th, label].map((k) => k.toLowerCase()).filter(Boolean)
    if (keys.includes(norm)) return label || input
  }
  return input
}

/** Split "English(ไทย)" into display parts for the workspace sidebar. */
export function displayHospitalName(label: string) {
  const raw = clean(label)
  const m = raw.match(/^(.*?)\((.+)\)\s*$/)
  if (m) return { title: clean(m[2]), subtitle: clean(m[1]), full: raw }
  return { title: raw, subtitle: '', full: raw }
}
