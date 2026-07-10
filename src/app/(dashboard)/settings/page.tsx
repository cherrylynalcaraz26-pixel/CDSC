'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useCompany } from '@/context/company-context'
import {
  Building2, Upload, RotateCcw, Save, Shield,
  FileText, Database, User, Globe, Phone, Mail, MapPin,
  CheckCircle2, Eye, EyeOff, Loader2, Plus, Trash2, X, Send,
} from 'lucide-react'
import { sendEmail } from '@/lib/send-email'
import { uploadImageToDrive } from '@/lib/upload-image'

const BUSINESS_TYPES = [
  'Sole Proprietorship', 'Partnership', 'Corporation', 'Trading Corporation',
  'Manufacturing', 'Service Provider', 'Distributor', 'Retailer',
  'Wholesaler', 'Cooperative', 'Non-Profit', 'Government Agency',
]

interface CoreService {
  name: string
  description: string
}

interface Settings {
  company_name: string
  company_short_name: string
  legal_suffix: string
  tagline: string
  business_type: string
  brand_positioning: string
  mission_statement: string
  sec_reg_no: string
  tin: string
  address: string
  city: string
  province: string
  zip_code: string
  phone: string
  mobile: string
  email: string
  website: string
  logo_url: string
  vat_registered: boolean
  default_vat_rate: number
  ewt_default_rate: number
  fiscal_year_start: string
  industry: string
  founded_year: string
  employees_count: string
  // Portfolio
  about_company: string
  core_services: CoreService[]
  key_clients: string
  certifications: string
  years_of_experience: string
  // Proposal
  proposal_introduction: string
  executive_summary: string
  scope_of_work: string
  terms_and_conditions: string
  payment_schedule: string
  validity_period: string
}

function defaultSettings(): Settings {
  return {
    company_name: 'CDSC Industrial Supply',
    company_short_name: 'CDSC',
    legal_suffix: 'Corporation',
    tagline: 'Supplying Solutions, Building Partnerships',
    business_type: 'Trading Corporation',
    brand_positioning: 'CDSC Industrial Supply Corporation is your trusted one-stop source for industrial supplies, safety equipment, and construction materials in Batangas and across the Philippines. We combine competitive pricing with reliable delivery to keep your operations running smoothly.',
    mission_statement: 'To provide industries and businesses with quality industrial supplies and exceptional service, delivered on time, every time — empowering our clients to achieve operational excellence and sustainable growth.',
    sec_reg_no: '',
    tin: '',
    address: '113 San Isidro Sur',
    city: 'Sto. Tomas',
    province: 'Batangas',
    zip_code: '4234',
    phone: '',
    mobile: '',
    email: 'cdsc.gmot@gmail.com',
    website: 'cdscindustrialsupply.netlify.app',
    logo_url: '',
    vat_registered: true,
    default_vat_rate: 12,
    ewt_default_rate: 2,
    fiscal_year_start: '01-01',
    industry: 'Industrial Supply & Distribution',
    founded_year: '',
    employees_count: '',
    about_company: 'CDSC Industrial Supply Corporation is a Philippine-based trading company specializing in the supply and distribution of industrial materials, safety equipment, hardware, and general construction supplies.\n\nStrategically located in Sto. Tomas, Batangas, we serve manufacturers, contractors, and businesses across Region IV-A (CALABARZON) and beyond. Our team is committed to sourcing quality products from trusted local and international suppliers, ensuring that our clients receive the best value for their investment.\n\nWith a customer-first approach, CDSC Industrial Supply has built a strong reputation for reliability, competitive pricing, and responsive service — making us the preferred industrial supply partner for businesses of all sizes.',
    core_services: [
      {
        name: 'Industrial Supply & Distribution',
        description: 'Comprehensive supply of industrial materials including pipes, fittings, valves, fasteners, bearings, belts, and mechanical components for manufacturing and maintenance operations.',
      },
      {
        name: 'Safety Equipment & PPE',
        description: 'Supply of personal protective equipment (PPE), safety gear, and workplace safety supplies compliant with DOLE and OSH standards — helmets, gloves, harnesses, eye protection, and more.',
      },
      {
        name: 'Construction & Hardware Supply',
        description: 'Wide selection of construction materials, tools, hardware, electrical supplies, and general building materials for commercial and industrial construction projects.',
      },
      {
        name: 'Janitorial & Maintenance Supplies',
        description: 'Complete range of janitorial, sanitation, and facility maintenance supplies for offices, factories, and commercial establishments.',
      },
      {
        name: 'Procurement & Sourcing',
        description: 'Dedicated procurement and sourcing services for hard-to-find or bulk industrial items. We coordinate with local and international suppliers to fulfill specialized requirements.',
      },
    ],
    key_clients: '',
    certifications: 'PhilGEPS Registered\nDTI Registered Business',
    years_of_experience: '',
    proposal_introduction: 'Dear Sir/Madam,\n\nThank you for the opportunity to present this proposal. CDSC Industrial Supply Corporation is pleased to offer our products and services to meet your operational requirements.\n\nWe are a trusted supplier of industrial materials, safety equipment, and general supplies based in Sto. Tomas, Batangas, serving clients across CALABARZON and the Philippines. Our commitment is to deliver quality products on time, at competitive prices, with the service reliability you can depend on.',
    executive_summary: 'CDSC Industrial Supply Corporation proposes to supply the required industrial materials, equipment, and/or services as specified herein. We commit to delivering quality-assured products sourced from reputable manufacturers and distributors.\n\nOur key value propositions:\n• Competitive and transparent pricing\n• Timely delivery with reliable logistics\n• Dedicated account management\n• Quality products from trusted suppliers\n• Flexible payment terms for qualified clients\n\nWe are confident that this proposal represents the best combination of quality, reliability, and value for your organization.',
    scope_of_work: 'The scope of this proposal covers the supply and delivery of the following:\n\n1. Products / Materials — As detailed in the attached quotation or purchase order.\n2. Delivery — Delivery to the client\'s designated location within the agreed lead time.\n3. Quality Assurance — All items delivered shall meet the specifications indicated in the order and shall be free from defects.\n4. Documentation — Complete delivery receipts, sales invoices, and product documentation shall be provided upon delivery.\n\nAny items not listed herein are considered out of scope and will be subject to a separate quotation.',
    terms_and_conditions: '1. VALIDITY — This proposal is valid for thirty (30) days from the date of issuance unless otherwise stated.\n\n2. PAYMENT TERMS — Payment shall be made as agreed. Overdue accounts are subject to a 2% monthly interest charge.\n\n3. DELIVERY — Lead times are subject to stock availability. CDSC shall notify the client promptly of any delays.\n\n4. PRICES — Quoted prices are exclusive of VAT (12%) unless otherwise stated. Prices are subject to change without prior notice due to supplier adjustments.\n\n5. RETURNS — Items may be returned within seven (7) days of delivery, provided they are in original condition, unused, and accompanied by the original delivery receipt. Custom or special-order items are non-returnable.\n\n6. WARRANTY — Warranty terms follow the original manufacturer\'s warranty, if applicable. CDSC does not cover damages arising from misuse or improper installation.\n\n7. FORCE MAJEURE — CDSC shall not be liable for delays caused by events beyond our reasonable control, including natural disasters, government orders, or supply chain disruptions.\n\n8. GOVERNING LAW — This agreement is governed by the laws of the Republic of the Philippines.',
    payment_schedule: '• 50% Down Payment — Upon approval and signing of Purchase Order\n• 50% Balance — Upon delivery and acceptance of goods\n\nAlternatively, full payment may be made within thirty (30) days from invoice date for qualified accounts with approved credit terms.\n\nAccepted payment methods: Bank transfer (BDO / BPI / UnionBank), check payable to CDSC Industrial Supply Corporation, or cash.',
    validity_period: '30 days',
  }
}

type TabId = 'profile' | 'proposal' | 'database' | 'security'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',   label: 'Company & Business Profile', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'proposal',  label: 'Business Proposal',  icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'database',  label: 'Proposal Database',  icon: <Database className="h-3.5 w-3.5" /> },
  { id: 'security',  label: 'Security',           icon: <Shield className="h-3.5 w-3.5" /> },
]

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ s }: { s: Settings }) {
  const fullName = [s.company_name || 'Company Name', s.legal_suffix].filter(Boolean).join(' ')
  const addressLine = [s.address, s.city, s.province, s.zip_code].filter(Boolean).join(', ')

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  function buildProfileHtml() {
    const services = (s.core_services ?? []).filter(svc => svc.name || svc.description)
    const certifications = (s.certifications ?? '').split('\n').map(c => c.trim()).filter(Boolean)
    return `<!DOCTYPE html><html><head><title>${fullName} – Company &amp; Business Profile</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
      .header { display: flex; align-items: flex-start; gap: 16px; border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 16px; }
      .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; }
      .logo-placeholder { width: 64px; height: 64px; background: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #94a3b8; }
      h1 { margin: 0 0 4px; font-size: 18px; color: #0f172a; }
      .tagline { color: #64748b; font-style: italic; font-size: 12px; margin: 0 0 6px; }
      .contact { font-size: 11px; color: #475569; line-height: 1.7; }
      .section { margin-bottom: 14px; page-break-inside: avoid; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #dc2626; border-bottom: 1px solid #fecaca; padding-bottom: 3px; margin: 18px 0 8px; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }
      .value { font-size: 12px; font-weight: 500; color: #1e293b; white-space: pre-line; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
      .svc { margin-bottom: 8px; page-break-inside: avoid; }
      .svc-name { font-size: 12px; font-weight: 700; color: #1e293b; }
      .svc-desc { font-size: 11px; color: #475569; line-height: 1.5; }
      .cert { display: inline-block; font-size: 11px; color: #15803d; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 999px; padding: 2px 10px; margin: 0 6px 6px 0; }
      .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    </style></head><body>
    <div class="header">
      ${s.logo_url ? `<img src="${s.logo_url}" class="logo" alt="logo" />` : '<div class="logo-placeholder">LOGO</div>'}
      <div>
        <h1>${fullName}</h1>
        ${s.tagline ? `<p class="tagline">${s.tagline}</p>` : ''}
        <div class="contact">
          ${addressLine ? `${addressLine}<br/>` : ''}
          ${s.phone ? `Tel: ${s.phone}` : ''}${s.mobile ? ` / ${s.mobile}` : ''}${(s.phone || s.mobile) ? '<br/>' : ''}
          ${s.email ? `Email: ${s.email}<br/>` : ''}
          ${s.website ? `Web: ${s.website}<br/>` : ''}
          ${s.tin ? `TIN: ${s.tin}` : ''}
        </div>
      </div>
    </div>
    <div class="grid2">
      ${s.business_type ? `<div><div class="label">Business Type</div><div class="value">${s.business_type}</div></div>` : ''}
      ${s.industry ? `<div><div class="label">Industry</div><div class="value">${s.industry}</div></div>` : ''}
      ${s.founded_year ? `<div><div class="label">Founded</div><div class="value">${s.founded_year}</div></div>` : ''}
      ${s.employees_count ? `<div><div class="label">Employees</div><div class="value">${s.employees_count}</div></div>` : ''}
      ${s.sec_reg_no ? `<div><div class="label">SEC Reg No</div><div class="value">${s.sec_reg_no}</div></div>` : ''}
      <div><div class="label">VAT</div><div class="value">${s.vat_registered ? `Registered (${s.default_vat_rate}%)` : 'Non-VAT'}</div></div>
    </div>
    ${s.mission_statement ? `<div class="section"><div class="label">Mission</div><div class="value">${s.mission_statement}</div></div>` : ''}
    ${s.brand_positioning ? `<div class="section"><div class="label">Brand Positioning</div><div class="value">${s.brand_positioning}</div></div>` : ''}
    ${s.about_company ? `<div class="section-title">About Us</div><div class="section"><div class="value">${s.about_company}</div></div>` : ''}
    ${s.years_of_experience ? `<div class="section"><div class="label">Years of Experience</div><div class="value">${s.years_of_experience}+ years</div></div>` : ''}
    ${services.length > 0 ? `<div class="section-title">Core Services</div><div class="section">${services.map(svc => `
      <div class="svc">
        ${svc.name ? `<div class="svc-name">• ${svc.name}</div>` : ''}
        ${svc.description ? `<div class="svc-desc">${svc.description}</div>` : ''}
      </div>`).join('')}</div>` : ''}
    ${s.key_clients ? `<div class="section-title">Key Clients</div><div class="section"><div class="value">${s.key_clients}</div></div>` : ''}
    ${certifications.length > 0 ? `<div class="section-title">Certifications &amp; Accreditations</div><div class="section">${certifications.map(c => `<span class="cert">✓ ${c}</span>`).join('')}</div>` : ''}
    <div class="footer">${fullName}</div>
    </body></html>`
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildProfileHtml())
    win.document.close()
    win.focus()
    win.print()
  }

  function openEmailDialog() {
    setEmailTo('')
    setEmailSubject(`Company & Business Profile – ${fullName}`)
    setEmailBody(
      `Dear Sir/Madam,\n\nPlease find attached our company & business profile:\n\n` +
      `Company: ${fullName}\n` +
      (s.tagline ? `Tagline: ${s.tagline}\n` : '') +
      (addressLine ? `Address: ${addressLine}\n` : '') +
      (s.phone ? `Tel: ${s.phone}\n` : '') +
      (s.email ? `Email: ${s.email}\n` : '') +
      (s.website ? `Website: ${s.website}\n` : '') +
      (s.tin ? `TIN: ${s.tin}\n` : '') +
      `\nThank you.`
    )
    setEmailOpen(true)
  }

  async function handleSendEmail() {
    if (!emailTo.trim()) { toast.error('Recipient email is required'); return }
    setSendingEmail(true)
    try {
      await sendEmail({
        to: emailTo.trim(),
        subject: emailSubject,
        body: emailBody,
        printHtml: buildProfileHtml(),
        pdfFilename: `${fullName} - Company & Business Profile.pdf`,
      })
      toast.success('Email sent')
      setEmailOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    }
    setSendingEmail(false)
  }

  return (
    <div className="sticky top-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        <span className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openEmailDialog}
            title="Send via Email"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Mail className="h-3 w-3" /> Email
          </button>
          <button
            onClick={handlePrint}
            title="Print Profile"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-3 w-3" /> Print
          </button>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● LIVE</span>
        </span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3">
          <p className="text-white/50 text-[10px] uppercase tracking-widest">Company Header</p>
        </div>

        {/* Header: logo + company info */}
        <div className="p-5 border-b">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-lg border bg-white flex items-center justify-center shrink-0 overflow-hidden">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base leading-tight text-slate-800">
                {fullName}
              </div>
              {s.tagline && <div className="text-xs text-slate-500 italic mt-0.5">{s.tagline}</div>}
              <div className="mt-1.5 space-y-0.5">
                {addressLine && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                    <span>{addressLine}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                  {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{s.phone}</span>}
                  {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" />{s.email}</span>}
                  {s.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3 text-slate-400" />{s.website}</span>}
                </div>
                {s.tin && <div className="text-[11px] text-slate-600 font-medium">TIN: {s.tin}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Company details */}
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {s.business_type && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Business Type</div>
                <div className="text-xs font-medium">{s.business_type}</div>
              </div>
            )}
            {s.industry && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Industry</div>
                <div className="text-xs font-medium">{s.industry}</div>
              </div>
            )}
            {s.founded_year && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Founded</div>
                <div className="text-xs font-medium">{s.founded_year}</div>
              </div>
            )}
            {s.employees_count && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Employees</div>
                <div className="text-xs font-medium">{s.employees_count}</div>
              </div>
            )}
            {s.sec_reg_no && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">SEC Reg No</div>
                <div className="text-xs font-medium">{s.sec_reg_no}</div>
              </div>
            )}
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">VAT</div>
              <div className="text-xs font-medium">{s.vat_registered ? `Registered (${s.default_vat_rate}%)` : 'Non-VAT'}</div>
            </div>
          </div>
          {s.mission_statement && (
            <div className="pt-1 border-t">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Mission</div>
              <div className="text-xs text-slate-600 leading-relaxed line-clamp-3">{s.mission_statement}</div>
            </div>
          )}
          {s.about_company && (
            <div className="pt-1 border-t">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">About Us</div>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-6">{s.about_company}</div>
            </div>
          )}
          {(s.years_of_experience || s.core_services.some(svc => svc.name || svc.description)) && (
            <div className="pt-1 border-t">
              {s.years_of_experience && (
                <div className="mb-2">
                  <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-100">
                    {s.years_of_experience}+ Years of Experience
                  </span>
                </div>
              )}
              {s.core_services.some(svc => svc.name || svc.description) && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Core Services</div>
                  <div className="space-y-1.5">
                    {s.core_services.filter(svc => svc.name || svc.description).map((svc, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <div>
                          {svc.name && <div className="text-xs font-semibold text-slate-700">{svc.name}</div>}
                          {svc.description && <div className="text-[11px] text-slate-500 leading-relaxed">{svc.description}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {s.key_clients && (
            <div className="pt-1 border-t">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Key Clients</div>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{s.key_clients}</div>
            </div>
          )}
          {s.certifications && (
            <div className="pt-1 border-t">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Certifications &amp; Accreditations</div>
              <div className="flex flex-wrap gap-1.5">
                {s.certifications.split('\n').filter(Boolean).map((cert, i) => (
                  <span key={i} className="text-[11px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                    ✓ {cert.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] text-muted-foreground text-right border-t pt-2">
            EWT Default: {s.ewt_default_rate}% &nbsp;·&nbsp; Fiscal Year: {s.fiscal_year_start}
          </div>
        </div>
      </div>

      {/* Letterhead / Business Card */}
      <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3">
          <p className="text-white/50 text-[10px] uppercase tracking-widest">Letterhead / Business Card</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Building2 className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{s.company_name || 'Company Name'}</div>
              {s.legal_suffix && <div className="text-white/50 text-[10px]">{s.legal_suffix}</div>}
            </div>
          </div>
          {s.tagline && <div className="text-white/60 text-xs italic mb-3 border-l-2 border-red-500 pl-2">{s.tagline}</div>}
          <div className="space-y-1 text-[11px] text-white/70">
            {addressLine && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-white/40" />{addressLine}</div>}
            {s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-white/40" />{s.phone}</div>}
            {s.mobile && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-white/40" />{s.mobile}</div>}
            {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-white/40" />{s.email}</div>}
            {s.website && <div className="flex items-center gap-1.5"><Globe className="h-3 w-3 text-white/40" />{s.website}</div>}
          </div>
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" />
              Send Company &amp; Business Profile by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>To (recipient email) <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">A PDF of the company &amp; business profile will be attached automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Proposal Live Preview ─────────────────────────────────────────────────────

function ProposalPreview({ s }: { s: Settings }) {
  return (
    <div className="sticky top-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Proposal Preview</span>
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● LIVE</span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm text-sm">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
              {s.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Building2 className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight">
                {s.company_name || 'Company Name'}{s.legal_suffix ? ` ${s.legal_suffix}` : ''}
              </div>
              {s.tagline && <div className="text-white/50 text-xs italic mt-0.5">{s.tagline}</div>}
              <div className="text-white/40 text-[11px] mt-1 space-x-3">
                {s.phone && <span>{s.phone}</span>}
                {s.email && <span>{s.email}</span>}
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-white/40 text-[10px] uppercase tracking-widest">Business Proposal</div>
            <div className="text-white font-bold text-lg">PROPOSAL FOR SERVICES</div>
            <div className="text-white/50 text-xs mt-0.5">
              Date: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
              {s.validity_period && <span className="ml-3">Valid for: {s.validity_period}</span>}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {s.proposal_introduction && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Introduction</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{s.proposal_introduction}</p>
            </div>
          )}
          {s.executive_summary && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Executive Summary</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{s.executive_summary}</p>
            </div>
          )}
          {s.scope_of_work && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Scope of Work</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{s.scope_of_work}</p>
            </div>
          )}
          {s.payment_schedule && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment Schedule</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{s.payment_schedule}</p>
            </div>
          )}
          {s.terms_and_conditions && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Terms &amp; Conditions</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{s.terms_and_conditions}</p>
            </div>
          )}
          {!s.proposal_introduction && !s.executive_summary && !s.scope_of_work && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Fill in the form fields to see your proposal preview
            </div>
          )}
          <div className="border-t pt-3 text-[10px] text-slate-400 text-center">
            {s.company_name}{s.legal_suffix ? ` ${s.legal_suffix}` : ''} · Confidential Business Proposal
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? '')
    })
  }, [])

  async function changePassword() {
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error(error.message)
    else { toast.success('Password updated'); setNewPw(''); setConfirmPw('') }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Account Security</h3>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Signed in as</div>
                <div className="text-sm font-medium">{email}</div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
            </div>
            <Separator />
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Change Password</Label>
              {/* Hidden username field so browser autofill associates the password
                  fields below with this account instead of hijacking an unrelated
                  input elsewhere on the page (e.g. the header search bar). */}
              <input type="text" name="username" autoComplete="username" value={email} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="New password (min. 8 characters)"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                />
              </div>
              <Button onClick={changePassword} disabled={saving || !newPw} className="bg-red-600 hover:bg-red-700 w-full">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</> : 'Update Password'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Session & Access</h3>
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Session Status</span>
              <span className="flex items-center gap-1.5 text-green-600 font-medium"><CheckCircle2 className="h-3.5 w-3.5" />Active</span>
            </div>
            <Separator />
            <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}>
              Sign Out of All Sessions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Proposal Tab ──────────────────────────────────────────────────────────────

interface ProposalTabProps {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => Promise<void>
  onReset: () => void
  saving: boolean
}

function ProposalTab({ settings, setSettings, onSave, onReset, saving }: ProposalTabProps) {
  function setField(field: keyof Settings, value: string) {
    setSettings(s => ({ ...s, [field]: value }))
  }

  const fields: { key: keyof Settings; label: string; placeholder: string; rows?: number }[] = [
    { key: 'proposal_introduction', label: 'Proposal Introduction', placeholder: 'Opening paragraph introducing your company and the purpose of this proposal…', rows: 4 },
    { key: 'executive_summary', label: 'Executive Summary', placeholder: 'Concise overview of your proposal, key benefits, and value proposition…', rows: 5 },
    { key: 'scope_of_work', label: 'Scope of Work', placeholder: 'Detailed description of what will be delivered, timelines, milestones…', rows: 6 },
    { key: 'terms_and_conditions', label: 'Terms & Conditions', placeholder: 'Legal terms, warranties, liabilities, and conditions of the proposal…', rows: 5 },
    { key: 'payment_schedule', label: 'Payment Schedule', placeholder: 'e.g. 50% upon signing, 50% upon completion…', rows: 3 },
    { key: 'validity_period', label: 'Validity Period', placeholder: 'e.g. 30 days', rows: 1 },
  ]

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-6 pb-4 border-b">
          <h2 className="font-bold text-base uppercase tracking-wider text-slate-700">Business Proposal Template</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />Reset
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-5">
          {fields.map(f => (
            <div key={String(f.key)} className="space-y-1.5">
              <Label className="font-semibold">{f.label}</Label>
              {f.rows === 1 ? (
                <Input
                  placeholder={f.placeholder}
                  value={settings[f.key] as string}
                  onChange={e => setField(f.key, e.target.value)}
                />
              ) : (
                <Textarea
                  rows={f.rows}
                  placeholder={f.placeholder}
                  value={settings[f.key] as string}
                  onChange={e => setField(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="pt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />Reset
          </Button>
          <Button onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Template
          </Button>
        </div>
      </div>

      <div className="hidden xl:block">
        <ProposalPreview s={settings} />
      </div>
    </div>
  )
}

// ── Proposal Database Tab ─────────────────────────────────────────────────────

interface Proposal {
  id: number
  proposal_number: string
  client: string
  title: string
  date: string
  amount: number
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

function ProposalDatabaseTab() {
  const supabase = createClient()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    client: '',
    title: '',
    amount: '',
    status: 'draft' as Proposal['status'],
  })

  // Email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailProposal, setEmailProposal] = useState<Proposal | null>(null)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  async function loadProposals() {
    setLoading(true)
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setProposals(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadProposals() }, [])

  function openNew() {
    setForm({ client: '', title: '', amount: '', status: 'draft' })
    setDialogOpen(true)
  }

  async function submitProposal() {
    if (!form.client.trim()) { toast.error('Client is required'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSubmitting(true)

    const year = new Date().getFullYear()
    const count = proposals.length + 1
    const proposal_number = `PROP-${year}-${String(count).padStart(4, '0')}`

    const { error } = await supabase.from('proposals').insert({
      proposal_number,
      client: form.client.trim(),
      title: form.title.trim(),
      amount: parseFloat(form.amount) || 0,
      status: form.status,
      date: new Date().toISOString().split('T')[0],
    })

    if (error) toast.error(error.message)
    else {
      toast.success('Proposal created')
      setDialogOpen(false)
      loadProposals()
    }
    setSubmitting(false)
  }

  async function deleteProposal(id: number) {
    const { error } = await supabase.from('proposals').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Proposal deleted')
      setProposals(ps => ps.filter(p => p.id !== id))
    }
  }

  function openEmailDialog(p: Proposal) {
    setEmailProposal(p)
    setEmailTo('')
    setEmailSubject(`Business Proposal – ${p.title} (${p.proposal_number})`)
    setEmailBody(`Dear ${p.client},\n\nPlease find attached our business proposal for "${p.title}".\n\nProposal No.: ${p.proposal_number}\nDate: ${p.date ? new Date(p.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}\n${p.amount ? `Amount: ₱${p.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}\n\nWe look forward to your favorable response.\n\nBest regards,\nCDSC Industrial Supply`)
    setEmailDialogOpen(true)
  }

  async function handleSendEmail() {
    if (!emailTo.trim()) { toast.error('Recipient email is required'); return }
    setSendingEmail(true)
    try {
      await sendEmail({
        to: emailTo.trim(),
        subject: emailSubject,
        body: emailBody,
        pdfFilename: `${emailProposal?.proposal_number ?? 'proposal'}.pdf`,
      })
      // Mark as sent if still draft
      if (emailProposal && emailProposal.status === 'draft') {
        await supabase.from('proposals').update({ status: 'sent' }).eq('id', emailProposal.id)
        setProposals(ps => ps.map(p => p.id === emailProposal.id ? { ...p, status: 'sent' } : p))
      }
      toast.success('Proposal email sent successfully')
      setEmailDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="font-bold text-base uppercase tracking-wider text-slate-700">Proposal Database</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''} on record</p>
        </div>
        <Button size="sm" onClick={openNew} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
          <Plus className="h-3.5 w-3.5" />New Proposal
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">No proposals yet. Create your first one.</p>
          <Button variant="outline" size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />New Proposal
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposal #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p, i) => (
                <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{p.proposal_number}</td>
                  <td className="px-4 py-3 font-medium">{p.client}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {p.date ? new Date(p.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {p.amount ? `₱${p.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[p.status] ?? ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEmailDialog(p)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                        title="Send proposal by email"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteProposal(p.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete proposal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" />
              Send Proposal by Email
            </DialogTitle>
          </DialogHeader>
          {emailProposal && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 mb-1">
              {emailProposal.proposal_number} — {emailProposal.title} — {emailProposal.client}
            </div>
          )}
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>To (recipient email) <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. ABC Corporation"
                value={form.client}
                onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Supply of Industrial Equipment"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Proposal['status'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submitProposal} disabled={submitting} className="bg-red-600 hover:bg-red-700 text-white gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient()
  const { reload: reloadCompany } = useCompany()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<TabId>('profile')
  const [settings, setSettings] = useState<Settings>(defaultSettings())
  const [original, setOriginal] = useState<Settings>(defaultSettings())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('system_settings').select('*').single()
      if (data) {
        const merged = {
          ...defaultSettings(),
          ...data,
          core_services: Array.isArray(data.core_services) ? data.core_services : [],
        }
        setSettings(merged)
        setOriginal(merged)
      }
    }
    load()
  }, [])

  function set(field: keyof Settings, value: string | boolean | number) {
    setSettings(s => ({ ...s, [field]: value }))
  }

  function addService() {
    setSettings(s => ({ ...s, core_services: [...s.core_services, { name: '', description: '' }] }))
  }

  function removeService(idx: number) {
    setSettings(s => ({ ...s, core_services: s.core_services.filter((_, i) => i !== idx) }))
  }

  function updateService(idx: number, field: 'name' | 'description', value: string) {
    setSettings(s => ({
      ...s,
      core_services: s.core_services.map((svc, i) => i === idx ? { ...svc, [field]: value } : svc),
    }))
  }

  function reset() {
    setSettings(original)
    toast.info('Changes reset')
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('system_settings').upsert({ id: 1, ...settings })
    if (error) toast.error(error.message)
    else { toast.success('Settings saved'); setOriginal(settings); await reloadCompany() }
    setSaving(false)
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error('File must be under 2 MB'); return }
    setUploading(true)
    let publicUrl: string
    try {
      publicUrl = await uploadImageToDrive(file)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
      setUploading(false)
      return
    }
    set('logo_url', publicUrl)
    // Also persist immediately so sidebar updates
    await supabase.from('system_settings').upsert({ id: 1, ...settings, logo_url: publicUrl })
    await reloadCompany()
    toast.success('Logo uploaded — sidebar and previews updated')
    setUploading(false)
  }

  const S = (field: keyof Settings) => ({
    value: settings[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
  })

  return (
    <div className="space-y-0">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Company Profile &amp; Settings</h1>
          <p className="text-muted-foreground text-sm">Business information, BIR details and preferences</p>
        </div>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'security' && <SecurityTab />}

      {tab === 'proposal' && (
        <ProposalTab
          settings={settings}
          setSettings={setSettings}
          onSave={save}
          onReset={reset}
          saving={saving}
        />
      )}

      {tab === 'database' && <ProposalDatabaseTab />}

      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          <div className="space-y-0">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <h2 className="font-bold text-base uppercase tracking-wider text-slate-700">Company Identity</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />Reset
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save All
                </Button>
              </div>
            </div>

            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Business Details</p>

              <div className="space-y-2">
                <Label>Company Logo</Label>
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.logo_url ? (
                      <img src={settings.logo_url} alt="logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 className="h-8 w-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button variant="outline" size="sm" className="gap-2 mb-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? 'Uploading…' : 'Upload Logo from File'}
                    </Button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]) }} />
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG — max 2 MB. Auto-appears on all invoices, quotations &amp; POs.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. CDSC Industrial Supply" {...S('company_name')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Legal Suffix</Label>
                  <Input placeholder="e.g. Corporation, Inc., Co." {...S('legal_suffix')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tagline / Slogan</Label>
                  <Input placeholder="e.g. Supplying Solutions, Building Partnerships" {...S('tagline')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Business Type</Label>
                  <Select value={settings.business_type} onValueChange={v => set('business_type', v ?? 'Trading Corporation')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Brand Positioning Statement</Label>
                <Textarea rows={3} placeholder="Describe how your company is positioned in the market…" {...S('brand_positioning')} />
              </div>

              <div className="space-y-1.5">
                <Label>Mission Statement</Label>
                <Textarea rows={3} placeholder="Your company's mission and purpose…" {...S('mission_statement')} />
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Registration &amp; Compliance</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>SEC / DTI Reg. No.</Label>
                  <Input placeholder="e.g. CS201812345" {...S('sec_reg_no')} />
                </div>
                <div className="space-y-1.5">
                  <Label>TIN</Label>
                  <Input placeholder="000-000-000-000" {...S('tin')} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input placeholder="e.g. Industrial Supply" {...S('industry')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Founded Year</Label>
                  <Input placeholder="e.g. 2015" {...S('founded_year')} />
                </div>
                <div className="space-y-1.5">
                  <Label>No. of Employees</Label>
                  <Input placeholder="e.g. 50-100" {...S('employees_count')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>VAT Registered</Label>
                  <Select value={settings.vat_registered ? 'yes' : 'no'} onValueChange={v => set('vat_registered', v === 'yes')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — VAT Registered</SelectItem>
                      <SelectItem value="no">No — Non-VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default VAT Rate (%)</Label>
                  <Input type="number" min={0} max={100} value={settings.default_vat_rate}
                    onChange={e => set('default_vat_rate', parseFloat(e.target.value) || 12)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>EWT Default Rate (%)</Label>
                  <Input type="number" min={0} max={100} value={settings.ewt_default_rate}
                    onChange={e => set('ewt_default_rate', parseFloat(e.target.value) || 2)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fiscal Year Start (MM-DD)</Label>
                  <Input placeholder="01-01" {...S('fiscal_year_start')} />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Contact &amp; Location</p>

              <div className="space-y-1.5">
                <Label>Street Address</Label>
                <Input placeholder="Building, street, barangay" {...S('address')} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>City / Municipality</Label>
                  <Input placeholder="e.g. Quezon City" {...S('city')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Province / Region</Label>
                  <Input placeholder="e.g. Metro Manila" {...S('province')} />
                </div>
                <div className="space-y-1.5">
                  <Label>ZIP Code</Label>
                  <Input placeholder="e.g. 1100" {...S('zip_code')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Landline / Phone</Label>
                  <Input placeholder="+63 2 8xxx xxxx" {...S('phone')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile</Label>
                  <Input placeholder="+63 9xx xxx xxxx" {...S('mobile')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="company@email.com" {...S('email')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input placeholder="www.company.com" {...S('website')} />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Business Profile</p>

              <div className="space-y-1.5">
                <Label className="font-semibold">About Company</Label>
                <Textarea
                  rows={5}
                  placeholder="Describe your company — history, background, what you do, and what sets you apart…"
                  {...S('about_company')}
                />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <Label className="font-semibold">Years of Experience</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 10"
                  {...S('years_of_experience')}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Core Services</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addService} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />Add Service
                  </Button>
                </div>
                {settings.core_services.length === 0 && (
                  <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
                    No services added yet. Click &quot;Add Service&quot; to begin.
                  </div>
                )}
                <div className="space-y-3">
                  {settings.core_services.map((svc, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/20 relative">
                      <button
                        type="button"
                        onClick={() => removeService(idx)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="space-y-1.5 pr-6">
                        <Label className="text-xs text-muted-foreground">Service Name</Label>
                        <Input
                          placeholder="e.g. Industrial Supply & Distribution"
                          value={svc.name}
                          onChange={e => updateService(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                          rows={2}
                          placeholder="Brief description of this service…"
                          value={svc.description}
                          onChange={e => updateService(idx, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Key Clients</Label>
                <Textarea
                  rows={3}
                  placeholder="List notable clients, one per line or comma-separated…"
                  {...S('key_clients')}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Certifications &amp; Accreditations</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. ISO 9001:2015, PhilGEPS Registered, PCAB Licensed…"
                  {...S('certifications')}
                />
              </div>
            </div>

            <div className="pt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />Reset
              </Button>
              <Button onClick={save} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save All
              </Button>
            </div>
          </div>

          <div className="hidden lg:block">
            <LivePreview s={settings} />
          </div>
        </div>
      )}
    </div>
  )
}
