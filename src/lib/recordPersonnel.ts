import { formatPersonName } from './personName'

export interface ApproverPerson {
  rankEn?: string | null
  rank?: string | null
  fullNameEn?: string | null
  fullName?: string | null
  name?: string | null
  role?: string | null
}

export function shouldSessionOwnCalibration(role: string | null | undefined) {
  return role === 'technician'
}

export function formatApproverOption(person: ApproverPerson) {
  const displayName = formatPersonName({
    rank: person.rankEn || person.rank,
    fullName: person.fullNameEn || person.fullName || person.name,
  })
  return person.role ? `${displayName} (${person.role})` : displayName
}
