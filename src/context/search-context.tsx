'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface SearchContextValue {
  query: string
  setQuery: (q: string) => void
}

const SearchContext = createContext<SearchContextValue>({ query: '', setQuery: () => {} })

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')
  const pathname = usePathname()

  // Clear search when navigating to a different page
  useEffect(() => { setQuery('') }, [pathname])

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearchContext() {
  return useContext(SearchContext)
}
