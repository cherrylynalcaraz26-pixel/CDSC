'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CompanyInfo {
  company_name: string
  company_short_name: string
  tagline: string
  logo_url: string
  address: string
  city: string
  province: string
  phone: string
  email: string
  website: string
  tin: string
}

const defaults: CompanyInfo = {
  company_name: 'CDSC Industrial Supply',
  company_short_name: 'CDSC',
  tagline: '',
  logo_url: '',
  address: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  website: '',
  tin: '',
}

interface CompanyContextValue {
  company: CompanyInfo
  reload: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue>({
  company: defaults,
  reload: async () => {},
})

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [company, setCompany] = useState<CompanyInfo>(defaults)

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('company_name,company_short_name,tagline,logo_url,address,city,province,phone,email,website,tin')
      .single()
    if (data) {
      setCompany({ ...defaults, ...data })
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <CompanyContext.Provider value={{ company, reload }}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  return useContext(CompanyContext)
}
