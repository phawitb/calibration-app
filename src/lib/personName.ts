export function formatPersonName({ rank, fullName }: { rank?: string | null; fullName?: string | null }) {
  const trimmedRank = String(rank || '').trim()
  const trimmedName = String(fullName || '').trim()
  if (!trimmedName) return trimmedRank
  if (!trimmedRank) return trimmedName
  return trimmedName.startsWith(trimmedRank) ? trimmedName : `${trimmedRank} ${trimmedName}`
}
