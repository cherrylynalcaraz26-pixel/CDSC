import type { Metadata } from 'next'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: {
    default: 'CDSC Industrial Supply — Industrial Supplier & Procurement Partner in Batangas, Philippines',
    template: '%s | CDSC Industrial Supply',
  },
  description:
    'CDSC Industrial Supply is a Philippine based B2B industrial supply and procurement company serving manufacturing, construction, and facility operations across Batangas and nearby areas.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-cdsc-ink">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
