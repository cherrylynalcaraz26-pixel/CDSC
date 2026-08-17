import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import {
  MapPin, Phone, Mail, Globe, BadgeCheck, Building2, Users, CalendarDays,
} from 'lucide-react'

// Render on every request instead of baking Company Profile data in at build
// time — otherwise edits made in Settings wouldn't show up here until the next deploy.
export const dynamic = 'force-dynamic'

interface CoreService {
  name: string
  description: string
}

interface PublicProfile {
  company_name: string
  company_short_name: string | null
  legal_suffix: string | null
  tagline: string | null
  business_type: string | null
  brand_positioning: string | null
  mission_statement: string | null
  industry: string | null
  founded_year: string | null
  employees_count: string | null
  about_company: string | null
  core_services: CoreService[] | null
  key_clients: string | null
  certifications: string | null
  years_of_experience: string | null
  address: string | null
  city: string | null
  province: string | null
  zip_code: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  website: string | null
  logo_url: string | null
}

// Public marketing page — reads only the subset of system_settings meant for
// outside visitors. Fetched with the service role key because system_settings'
// RLS only grants SELECT to `authenticated`, and this route has no signed-in
// user; the key never leaves the server since this is an async Server Component.
async function getProfile(): Promise<PublicProfile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data } = await supabase
    .from('system_settings')
    .select(`
      company_name, company_short_name, legal_suffix, tagline, business_type,
      brand_positioning, mission_statement, industry, founded_year, employees_count,
      about_company, core_services, key_clients, certifications, years_of_experience,
      address, city, province, zip_code, phone, mobile, email, website, logo_url
    `)
    .single()

  return data as PublicProfile | null
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getProfile()
  const name = s?.company_name ?? 'Company Profile'
  return {
    title: `${name}${s?.legal_suffix ? ` ${s.legal_suffix}` : ''} — Company Profile`,
    description: s?.tagline || s?.brand_positioning || undefined,
  }
}

export default async function CompanyProfilePage() {
  const s = await getProfile()

  if (!s) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Company profile is not available right now.
      </div>
    )
  }

  const fullName = [s.company_name || 'Company Name', s.legal_suffix].filter(Boolean).join(' ')
  const addressLine = [s.address, s.city, s.province, s.zip_code].filter(Boolean).join(', ')
  const services = (s.core_services ?? []).filter(svc => svc.name || svc.description)
  const certifications = (s.certifications ?? '').split('\n').map(c => c.trim()).filter(Boolean)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-red-950">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16 sm:py-20 flex flex-col items-center text-center">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-white shadow-xl flex items-center justify-center overflow-hidden shrink-0">
            {s.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo_url} alt={fullName} className="h-full w-full object-contain p-2" />
            ) : (
              <Building2 className="h-10 w-10 text-slate-300" />
            )}
          </div>
          <h1 className="mt-6 text-2xl sm:text-4xl font-bold text-white tracking-tight">{fullName}</h1>
          {s.tagline && <p className="mt-2 text-red-200 italic text-sm sm:text-base">{s.tagline}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-slate-300">
            {addressLine && (
              <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-red-400" />{addressLine}
              </span>
            )}
            {(s.phone || s.mobile) && (
              <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
                <Phone className="h-3.5 w-3.5 text-red-400" />{[s.phone, s.mobile].filter(Boolean).join(' / ')}
              </span>
            )}
            {s.email && (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors">
                <Mail className="h-3.5 w-3.5 text-red-400" />{s.email}
              </a>
            )}
            {s.website && (
              <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors">
                <Globe className="h-3.5 w-3.5 text-red-400" />{s.website}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16 space-y-14">
        {/* At-a-glance stat strip */}
        {(s.business_type || s.industry || s.founded_year || s.employees_count || s.years_of_experience) && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {s.business_type && <StatCard icon={<Building2 className="h-4 w-4" />} label="Business Type" value={s.business_type} />}
            {s.industry && <StatCard icon={<BadgeCheck className="h-4 w-4" />} label="Industry" value={s.industry} />}
            {s.founded_year && <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Founded" value={s.founded_year} />}
            {(s.employees_count || s.years_of_experience) && (
              <StatCard icon={<Users className="h-4 w-4" />} label={s.employees_count ? 'Employees' : 'Experience'} value={s.employees_count || `${s.years_of_experience}+ years`} />
            )}
          </section>
        )}

        {/* Mission / positioning */}
        {(s.mission_statement || s.brand_positioning) && (
          <section className="text-center max-w-3xl mx-auto space-y-4">
            {s.mission_statement && <p className="text-lg sm:text-xl font-semibold text-slate-800 leading-snug">&ldquo;{s.mission_statement}&rdquo;</p>}
            {s.brand_positioning && <p className="text-sm text-slate-500 leading-relaxed">{s.brand_positioning}</p>}
          </section>
        )}

        {/* About */}
        {s.about_company && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <SectionTitle>About Us</SectionTitle>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.about_company}</p>
          </section>
        )}

        {/* Core services */}
        {services.length > 0 && (
          <section>
            <SectionTitle center>What We Do</SectionTitle>
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {services.map((svc, i) => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-red-200 hover:shadow-md transition-all">
                  {svc.name && <div className="font-semibold text-slate-800 mb-1.5">{svc.name}</div>}
                  {svc.description && <div className="text-sm text-slate-500 leading-relaxed">{svc.description}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Key clients + certifications */}
        {(s.key_clients || certifications.length > 0) && (
          <section className="grid sm:grid-cols-2 gap-6">
            {s.key_clients && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionTitle>Key Clients</SectionTitle>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.key_clients}</p>
              </div>
            )}
            {certifications.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionTitle>Certifications &amp; Accreditations</SectionTitle>
                <div className="mt-3 flex flex-wrap gap-2">
                  {certifications.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                      <BadgeCheck className="h-3 w-3" />{c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* CTA */}
        <section className="bg-gradient-to-br from-red-700 to-red-900 rounded-2xl px-6 sm:px-10 py-10 text-center text-white shadow-lg">
          <h2 className="text-xl sm:text-2xl font-bold">Let&rsquo;s Build Your Success Together</h2>
          <p className="mt-2 text-red-100 text-sm max-w-xl mx-auto leading-relaxed">
            Experience quality products, competitive pricing, and reliable on-time delivery. Reach out for a free quotation today.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
            {s.email && (
              <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 bg-white text-red-700 rounded-full px-5 py-2 hover:bg-red-50 transition-colors">
                <Mail className="h-4 w-4" />{s.email}
              </a>
            )}
            {(s.phone || s.mobile) && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-5 py-2">
                <Phone className="h-4 w-4" />{[s.phone, s.mobile].filter(Boolean).join(' / ')}
              </span>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        {fullName}
      </footer>
    </div>
  )
}

function SectionTitle({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">{children}</p>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center gap-1.5">
      <span className="text-red-600">{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}
