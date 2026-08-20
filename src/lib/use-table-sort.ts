'use client'

import { useMemo, useState } from 'react'

// Generic click-to-sort state for a table: tracks which column key is active and
// its direction, and returns the rows sorted by whatever `accessor` extracts for
// that key. Pair with `SortableTableHead` (src/components/ui/table.tsx) for the
// clickable header UI.
export function useTableSort<T, K extends string>(
  rows: T[],
  accessor: (row: T, key: K) => string | number,
) {
  const [sortKey, setSortKey] = useState<K | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function onSort(key: K) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = accessor(a, sortKey)
      const bv = accessor(b, sortKey)
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sortKey, sortDir])

  return { sorted, sortKey, sortDir, onSort }
}
