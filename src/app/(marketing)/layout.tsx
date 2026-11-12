import type { Metadata } from 'next'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { NoDownload } from '@/components/marketing/no-download'
import { getSiteContent } from '@/lib/site-content-server'
import { companyWithContact } from '@/lib/site-content'

export const metadata: Metadata = {
  title: {
    default: 'CDSC Industrial Supply — Industrial Supplier & Procurement Partner in Batangas, Philippines',
    template: '%s | CDSC Industrial Supply',
  },
  description:
    'CDSC Industrial Supply is a Philippine based B2B industrial supply and procurement company serving manufacturing, construction, and facility operations across Batangas and nearby areas.',
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const c = companyWithContact((await getSiteContent()).contact)
  return (
    <div className="flex min-h-screen flex-col bg-white text-cdsc-ink [&_img]:select-none [&_img]:[-webkit-user-drag:none]">
      <NoDownload />
      <SiteHeader contact={{ phone: c.phone, phoneHref: c.phoneHref, email: c.email, emailHref: c.emailHref }} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
