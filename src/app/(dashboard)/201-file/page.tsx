'use client'

// 201 File — the master records of the people CDSC deals with, on one page:
// Clients (the existing client records) and CDSC Employees.

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Building2, IdCard } from 'lucide-react'
import { Segmented } from '@/components/ui/filter-bar'
import { EmployeesPanel } from '@/components/hr/employees-panel'
import ClientsPage from '@/app/(dashboard)/clients/page'

function File201Content() {
  const router = useRouter()
  const pathname = usePathname()
  const tab = useSearchParams().get('tab') === 'employees' ? 'employees' : 'clients'
  return (
    <div className="space-y-5">
      <Segmented value={tab} onChange={t => router.replace(t === 'employees' ? `${pathname}?tab=employees` : pathname, { scroll: false })} options={[
        { value: 'clients', label: 'Clients', icon: Building2 },
        { value: 'employees', label: 'CDSC Employees', icon: IdCard },
      ]} />
      {tab === 'clients' ? <ClientsPage /> : <EmployeesPanel />}
    </div>
  )
}

export default function File201Page() {
  return <Suspense fallback={null}><File201Content /></Suspense>
}
