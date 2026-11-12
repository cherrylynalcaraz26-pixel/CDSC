import { redirect } from 'next/navigation'

// The Reports Center now lives under Settings → Reports.
export default function ReportsPage() {
  redirect('/settings?tab=reports')
}
