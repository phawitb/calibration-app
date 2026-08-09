import { useState, useMemo, useCallback } from 'react'

type SortDir = 'asc' | 'desc'

export function useTableSort<T>(data: T[], defaultKey = '', defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  const toggle = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const va = String((a as any)[sortKey] ?? '')
      const vb = String((b as any)[sortKey] ?? '')
      const cmp = va.localeCompare(vb, 'th', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggle }
}

export function sortIcon(sortKey: string, sortDir: SortDir, col: string) {
  if (sortKey !== col) return ' \u2195'
  return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
}
