const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

export function formatPdfDate(value: unknown): string {
  if (!value) return '-'

  const dateParts = typeof value === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
    : null
  const date = dateParts
    ? new Date(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3]))
    : new Date(value as string | number | Date)

  if (Number.isNaN(date.getTime())) return '-'

  const day = String(date.getDate()).padStart(2, '0')
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
