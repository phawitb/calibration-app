/** Calendar search accepts Buddhist/Common Era years, d/m/yyyy and yyyy-mm-dd. */
export function calibrationDateRange(input: string) {
  const value = input.trim()
  let year: number, month = 1, day = 1, precision: 'year' | 'day' = 'year'
  if (/^\d{4}$/.test(value)) year = Number(value)
  else {
    const local = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (local) { day = Number(local[1]); month = Number(local[2]); year = Number(local[3]) }
    else if (iso) { year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]) }
    else return null
    precision = 'day'
  }
  if (year >= 2400) year -= 543
  if (year < 1900 || year > 2300) return null
  const start = new Date(Date.UTC(year, month - 1, day))
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null
  const end = precision === 'year' ? new Date(Date.UTC(year + 1, 0, 1)) : new Date(start.getTime() + 86400000)
  return { $gte: start, $lt: end }
}

/** Day/month searches intentionally match every year; other filters still apply. */
export function calibrationDateSearch(input: string) {
  const range = calibrationDateRange(input)
  if (range) return { calDate: range }
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return null
  const day = Number(match[1]), month = Number(match[2])
  // Leap year allows 29/2, while rejecting impossible dates such as 31/2.
  const date = new Date(Date.UTC(2000, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  const converted = { $convert: { input: '$calDate', to: 'date', onError: null, onNull: null } }
  return { $expr: { $and: [
    { $eq: [{ $dayOfMonth: converted }, day] },
    { $eq: [{ $month: converted }, month] },
  ] } }
}
