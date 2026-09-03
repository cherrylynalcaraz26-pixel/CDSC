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
import { getErrorMessage } from '@/lib/error-message'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useCompany } from '@/context/company-context'
import {
  Building2, Upload, RotateCcw, Save, Shield,
  FileText, Database, User, Globe, Phone, Mail, MapPin,
  CheckCircle2, Eye, EyeOff, Loader2, Plus, Trash2, X, Send,
  ChevronDown, ChevronUp, Download, Cloud, ExternalLink, RefreshCw,
} from 'lucide-react'
import { sendEmail, htmlToPdfBase64 } from '@/lib/send-email'
import { uploadImageToDrive } from '@/lib/upload-image'
import { syncDatabaseBackup, type BackupSyncResult } from '@/lib/backup-sheets'

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
  registration_doc_url: string
  live_video_url: string
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
    registration_doc_url: '',
    live_video_url: '',
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

type TabId = 'profile' | 'database' | 'backup' | 'security'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',   label: 'Company & Business Profile', icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'database',  label: 'Proposal Database',  icon: <Database className="h-3.5 w-3.5" /> },
  { id: 'backup',    label: 'Data Backup',        icon: <Cloud className="h-3.5 w-3.5" /> },
  { id: 'security',  label: 'Security',           icon: <Shield className="h-3.5 w-3.5" /> },
]

// ── Collapsible form section ──────────────────────────────────────────────────

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors rounded-xl"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">{title}</p>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-5 space-y-5">{children}</div>}
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ s }: { s: Settings }) {
  const fullName = [s.company_name || 'Company Name', s.legal_suffix].filter(Boolean).join(' ')
  const addressLine = [s.address, s.city, s.province, s.zip_code].filter(Boolean).join(', ')

  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  function buildProfileHtml() {
    const services = (s.core_services ?? []).filter(svc => svc.name || svc.description)
    const certifications = (s.certifications ?? '').split('\n').map(c => c.trim()).filter(Boolean)
    return `<!DOCTYPE html><html><head><title>${fullName} – Company &amp; Business Profile</title>
    <style>
      @font-face { font-family: 'Questrial'; src: url('/fonts/Questrial-Regular.ttf') format('truetype'); font-weight: normal; }
      body { font-family: 'Questrial', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: #fff; padding: 22px 24px; border-radius: 10px; margin: -24px -24px 20px; }
      .logo { width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: #fff; padding: 4px; }
      .logo-placeholder { width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 10px; color: rgba(255,255,255,0.6); }
      .header-info { text-align: right; }
      h1 { margin: 0 0 4px; font-size: 18px; color: #fff; }
      .tagline { color: #cbd5e1; font-style: italic; font-size: 12px; margin: 0 0 6px; }
      .contact { font-size: 11px; color: #e2e8f0; line-height: 1.7; }
      .section { margin-bottom: 14px; page-break-inside: avoid; }
      .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #dc2626; border-bottom: 1px solid #fecaca; padding-bottom: 3px; margin: 18px 0 8px; }
      .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }
      .value { font-size: 12px; font-weight: 500; color: #1e293b; white-space: pre-line; }
      .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
      .svc { margin-bottom: 8px; page-break-inside: avoid; }
      .svc-name { font-size: 12px; font-weight: 700; color: #1e293b; }
      .svc-desc { font-size: 11px; color: #475569; line-height: 1.5; }
      .cert { display: inline-block; font-size: 11px; color: #15803d; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 999px; padding: 2px 10px; margin: 0 6px 6px 0; }
      .cta { background: linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%); color: #fff; border-radius: 10px; padding: 18px 20px; text-align: center; margin: 22px 0 14px; page-break-inside: avoid; }
      .cta-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
      .cta-text { font-size: 11px; line-height: 1.6; color: #fecaca; margin-bottom: 10px; }
      .cta-contact { font-size: 11px; font-weight: 700; letter-spacing: 0.02em; }
      .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      @media print {
        @page { margin: 12mm; size: A4 portrait; }
        body { padding: 0; }
        .cta { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>
    <div class="header">
      ${s.logo_url ? `<img src="${s.logo_url}" class="logo" alt="logo" />` : '<div class="logo-placeholder">LOGO</div>'}
      <div class="header-info">
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
    ${s.proposal_introduction ? `<div class="section-title">A Message to Our Valued Clients</div><div class="section"><div class="value">${s.proposal_introduction}</div></div>` : ''}
    ${s.executive_summary ? `<div class="section-title">Why Choose ${s.company_short_name || 'Us'}</div><div class="section"><div class="value">${s.executive_summary}</div></div>` : ''}
    ${s.scope_of_work ? `<div class="section-title">What We Deliver</div><div class="section"><div class="value">${s.scope_of_work}</div></div>` : ''}
    ${s.payment_schedule ? `<div class="section-title">Flexible Payment Options</div><div class="section"><div class="value">${s.payment_schedule}</div></div>` : ''}
    ${s.terms_and_conditions ? `<div class="section-title">Terms &amp; Conditions</div><div class="section"><div class="value">${s.terms_and_conditions}</div></div>` : ''}
    <div class="cta">
      <div class="cta-title">Let&rsquo;s Build Your Success Together!</div>
      <div class="cta-text">Experience quality products, competitive pricing, and reliable on-time delivery. We would love to be your trusted supply partner &mdash; request a free quotation today${s.validity_period ? ` (proposals valid for ${s.validity_period})` : ''}.</div>
      <div class="cta-contact">${[s.phone || s.mobile, s.email, s.website].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
    </div>
    <div class="footer">${fullName}</div>
    </body></html>`
  }

  function handlePrint() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildProfileHtml())
    win.document.close()
    win.focus()
    // Give the logo image time to load before printing, otherwise it's
    // missing from the printed/saved PDF.
    setTimeout(() => { win.print() }, 400)
  }

  async function downloadProfilePdf() {
    setDownloadingPdf(true)
    try {
      const base64 = await htmlToPdfBase64(buildProfileHtml())
      const bytes = atob(base64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${fullName} - Company Profile.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate PDF'))
    }
    setDownloadingPdf(false)
  }

  function openEmailDialog() {
    setEmailTo('')
    setEmailSubject(`Company & Business Profile – ${fullName}`)
    // Keep the message itself short — the full profile is in the attached PDF
    // (regenerated fresh from current Settings data on every send). Contact
    // details move into a closing signature block instead of being dumped
    // right after the greeting.
    setEmailBody(
      `Dear Sir/Madam,\n\nPlease find attached our company & business profile for your reference.\n\nThank you.\n\n` +
      `—\n` +
      `${fullName}\n` +
      (s.tagline ? `${s.tagline}\n` : '') +
      (addressLine ? `${addressLine}\n` : '') +
      [s.phone, s.mobile].filter(Boolean).join(' / ') + (s.phone || s.mobile ? '\n' : '') +
      (s.email ? `${s.email}\n` : '') +
      (s.website ? `${s.website}\n` : '') +
      (s.tin ? `TIN: ${s.tin}\n` : '')
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
      toast.error(getErrorMessage(err, 'Failed to send email'))
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
          <button
            onClick={downloadProfilePdf}
            disabled={downloadingPdf}
            title="Download PDF"
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {downloadingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
          </button>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● LIVE</span>
        </span>
      </div>

      <div className="border rounded-2xl overflow-hidden bg-white shadow-lg">
        <div className="bg-gradient-to-r from-red-700 to-red-900 px-5 py-3">
          <p className="text-white/60 text-[10px] uppercase tracking-widest">Company Letterhead</p>
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
        <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
    if (error) { toast.error(getErrorMessage(error)); setSaving(false); return }
    setNewPw(''); setConfirmPw('')
    // Sign out and require a fresh login with the new password
    toast.success('Password updated — please sign in again with your new password')
    await supabase.auth.signOut()
    setTimeout(() => { window.location.href = '/login' }, 1500)
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

// ── Proposal Database Tab ─────────────────────────────────────────────────────

// PDF attached when a proposal is emailed from the database: the saved
// Business Proposal template filled in with this proposal's details.
function buildProposalHtml(s: Settings, p: Proposal) {
  const fullName = [s.company_name || 'Company Name', s.legal_suffix].filter(Boolean).join(' ')
  const addressLine = [s.address, s.city, s.province, s.zip_code].filter(Boolean).join(', ')
  const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const amountStr = p.amount ? `₱${p.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''
  return `<!DOCTYPE html><html><head><title>${p.proposal_number} – Business Proposal</title>
  <style>
    @font-face { font-family: 'Questrial'; src: url('/fonts/Questrial-Regular.ttf') format('truetype'); font-weight: normal; }
    body { font-family: 'Questrial', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
    .header { display: flex; align-items: flex-start; gap: 16px; border-bottom: 2px solid #dc2626; padding-bottom: 16px; margin-bottom: 16px; }
    .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; }
    h1 { margin: 0 0 4px; font-size: 18px; color: #0f172a; }
    .tagline { color: #64748b; font-style: italic; font-size: 12px; margin: 0 0 6px; }
    .contact { font-size: 11px; color: #475569; line-height: 1.7; }
    .doc-title { font-size: 20px; font-weight: 700; color: #dc2626; text-align: center; margin: 4px 0 14px; letter-spacing: 0.04em; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; background: #f8fafc; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin-bottom: 2px; }
    .value { font-size: 12px; font-weight: 600; color: #1e293b; white-space: pre-line; }
    .section { margin-bottom: 14px; page-break-inside: avoid; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #dc2626; border-bottom: 1px solid #fecaca; padding-bottom: 3px; margin: 18px 0 8px; }
    .text { font-size: 12px; color: #1e293b; line-height: 1.6; white-space: pre-line; }
    .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; text-align: center; }
  </style></head><body>
  <div class="header">
    ${s.logo_url ? `<img src="${s.logo_url}" class="logo" alt="logo" />` : ''}
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
  <div class="doc-title">BUSINESS PROPOSAL</div>
  <div class="meta">
    <div><div class="label">Proposal No.</div><div class="value">${p.proposal_number}</div></div>
    ${dateStr ? `<div><div class="label">Date</div><div class="value">${dateStr}</div></div>` : ''}
    <div><div class="label">Prepared For</div><div class="value">${p.client}</div></div>
    <div><div class="label">Subject</div><div class="value">${p.title}</div></div>
    ${amountStr ? `<div><div class="label">Proposal Amount</div><div class="value">${amountStr}</div></div>` : ''}
    ${s.validity_period ? `<div><div class="label">Valid For</div><div class="value">${s.validity_period}</div></div>` : ''}
  </div>
  ${s.proposal_introduction ? `<div class="section-title">Introduction</div><div class="section"><div class="text">${s.proposal_introduction}</div></div>` : ''}
  ${s.executive_summary ? `<div class="section-title">Executive Summary</div><div class="section"><div class="text">${s.executive_summary}</div></div>` : ''}
  ${s.scope_of_work ? `<div class="section-title">Scope of Work</div><div class="section"><div class="text">${s.scope_of_work}</div></div>` : ''}
  ${s.payment_schedule ? `<div class="section-title">Payment Schedule</div><div class="section"><div class="text">${s.payment_schedule}</div></div>` : ''}
  ${s.terms_and_conditions ? `<div class="section-title">Terms &amp; Conditions</div><div class="section"><div class="text">${s.terms_and_conditions}</div></div>` : ''}
  <div class="footer">${fullName} · Confidential Business Proposal · ${p.proposal_number}</div>
  </body></html>`
}

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

// Live document preview shown next to the inline New Proposal form.
function ProposalLivePreview({ s, client, title, amount, number }: {
  s: Settings; client: string; title: string; amount: string; number: string
}) {
  const fullName = [s.company_name || 'Company Name', s.legal_suffix].filter(Boolean).join(' ')
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const amt = parseFloat(amount) || 0
  return (
    <div className="sticky top-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Proposal Preview</span>
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● LIVE</span>
      </div>

      <div className="border rounded-2xl overflow-hidden bg-white shadow-lg text-sm">
        <div className="bg-gradient-to-r from-red-700 to-red-900 p-5">
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
              <div className="text-white font-bold text-base leading-tight">{fullName}</div>
              {s.tagline && <div className="text-white/50 text-xs italic mt-0.5">{s.tagline}</div>}
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="text-white/40 text-[10px] uppercase tracking-widest">Business Proposal</div>
            <div className="text-white font-bold text-lg font-mono">{number}</div>
            <div className="text-white/50 text-xs mt-0.5">
              Date: {today}
              {s.validity_period && <span className="ml-3">Valid for: {s.validity_period}</span>}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 border rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prepared For</div>
              <div className="text-xs font-semibold">{client.trim() || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Subject</div>
              <div className="text-xs font-semibold">{title.trim() || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</div>
              <div className="text-xs font-semibold">{amt > 0 ? `₱${amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</div>
              <div className="text-xs font-semibold">{today}</div>
            </div>
          </div>

          {s.proposal_introduction && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Introduction</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-4">{s.proposal_introduction}</p>
            </div>
          )}
          {s.executive_summary && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Executive Summary</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-4">{s.executive_summary}</p>
            </div>
          )}
          {s.scope_of_work && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Scope of Work</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-4">{s.scope_of_work}</p>
            </div>
          )}
          {s.payment_schedule && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Payment Schedule</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-4">{s.payment_schedule}</p>
            </div>
          )}
          {s.terms_and_conditions && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Terms &amp; Conditions</div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed line-clamp-4">{s.terms_and_conditions}</p>
            </div>
          )}
          <div className="border-t pt-3 text-[10px] text-slate-400 text-center">
            {fullName} · Confidential Business Proposal
          </div>
        </div>
      </div>
    </div>
  )
}

function ProposalDatabaseTab({ settings, proposals, loading, onReload }: {
  settings: Settings
  proposals: Proposal[]
  loading: boolean
  onReload: () => Promise<void>
}) {
  const supabase = createClient()
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

  const nextNumber = `PROP-${new Date().getFullYear()}-${String(proposals.length + 1).padStart(4, '0')}`

  async function submitProposal(sendAfter: boolean) {
    if (!form.client.trim()) { toast.error('Client is required'); return }
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSubmitting(true)

    const { data, error } = await supabase.from('proposals').insert({
      proposal_number: nextNumber,
      client: form.client.trim(),
      title: form.title.trim(),
      amount: parseFloat(form.amount) || 0,
      status: form.status,
      date: new Date().toISOString().split('T')[0],
    }).select().single()

    if (error) {
      toast.error(getErrorMessage(error))
    } else {
      toast.success('Proposal saved')
      setForm({ client: '', title: '', amount: '', status: 'draft' })
      await onReload()
      if (sendAfter && data) openEmailDialog(data as Proposal)
    }
    setSubmitting(false)
  }

  async function deleteProposal(id: number) {
    const { error } = await supabase.from('proposals').delete().eq('id', id)
    if (error) toast.error(getErrorMessage(error))
    else {
      toast.success('Proposal deleted')
      await onReload()
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
    if (!emailProposal) return
    if (!emailTo.trim()) { toast.error('Recipient email is required'); return }
    setSendingEmail(true)
    try {
      await sendEmail({
        to: emailTo.trim(),
        subject: emailSubject,
        body: emailBody,
        printHtml: buildProposalHtml(settings, emailProposal),
        pdfFilename: `${emailProposal.proposal_number}.pdf`,
      })
      // Mark as sent if still draft
      if (emailProposal.status === 'draft') {
        await supabase.from('proposals').update({ status: 'sent' }).eq('id', emailProposal.id)
        await onReload()
      }
      toast.success('Proposal email sent successfully')
      setEmailDialogOpen(false)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to send email'))
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h2 className="font-bold text-base uppercase tracking-wider text-slate-700">Proposal Database</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''} on record</p>
        </div>
      </div>

      {/* Inline new proposal form */}
      <div className="border rounded-xl p-5 space-y-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-600">New Proposal</p>
          <span className="text-xs font-mono text-muted-foreground">{nextNumber}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: (v ?? 'draft') as Proposal['status'] }))}>
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => submitProposal(false)} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Proposal
          </Button>
          <Button onClick={() => submitProposal(true)} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Save &amp; Send Email
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-3">
          <FileText className="h-10 w-10 opacity-20" />
          <p className="text-sm">No proposals yet. Fill in the form above to save your first one.</p>
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
        <DialogContent className="w-[95vw] max-w-3xl">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">A PDF of the proposal will be attached automatically.</p>
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
    </div>

    {/* Live preview column */}
    <div className="hidden xl:block">
      <ProposalLivePreview s={settings} client={form.client} title={form.title} amount={form.amount} number={nextNumber} />
    </div>
    </div>
  )
}

// ── Data Backup Tab ────────────────────────────────────────────────────────────

const BACKUP_TABLE_LABELS: Record<string, string> = {
  items: 'Items (catalog)',
  suppliers: 'Suppliers',
  purchase_orders: 'Purchase Orders',
  po_items: 'PO Line Items',
  clients: 'Clients',
  sales_orders: 'Sales Orders',
  so_items: 'SO Line Items',
  warehouse_stock: 'Warehouse Stock',
  warehouse_stock_ledger: 'Warehouse Stock Ledger',
}

interface BackupLogEntry {
  id: string
  synced_at: string
  url: string
  total_rows: number
  tables: { name: string; rows: number }[]
  triggered_by_email: string | null
}

function BackupTab() {
  const supabase = createClient()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<BackupSyncResult | null>(null)
  const [history, setHistory] = useState<BackupLogEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  async function loadHistory() {
    setHistoryLoading(true)
    const { data, error } = await supabase
      .from('backup_sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(20)
    if (error) toast.error(getErrorMessage(error))
    else setHistory(data ?? [])
    setHistoryLoading(false)
  }

  useEffect(() => { loadHistory() }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const data = await syncDatabaseBackup()
      setResult(data)
      toast.success('Database synced to Google Sheets')
      await loadHistory()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to sync backup'))
    }
    setSyncing(false)
  }

  const totalRows = result?.tables.reduce((sum, t) => sum + t.rows, 0) ?? 0

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Google Sheets Backup</h3>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Exports the core business tables — items, suppliers, purchase orders, sales orders,
              clients, and warehouse stock (with its ledger) — to a single Google Sheet, one tab per
              table. Syncing again overwrites the same Sheet in place, so the link never changes.
            </p>
            <Button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : 'Sync to Google Sheets'}
            </Button>

            {result && (
              <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> Last synced {new Date(result.syncedAt).toLocaleString('en-PH')}
                  </span>
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Open Sheet <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  {result.tables.map(t => (
                    <div key={t.name} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{BACKUP_TABLE_LABELS[t.name] ?? t.name}</span>
                      <span className="font-mono font-medium">{t.rows.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground text-right pt-1 border-t">
                  {totalRows.toLocaleString()} rows total
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Sync History</h3>
        <Card>
          <CardContent className="pt-5">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No syncs yet.</p>
            ) : (
              <div className="space-y-0">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between gap-3 py-2.5 border-b last:border-0 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{new Date(h.synced_at).toLocaleString('en-PH')}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {h.total_rows.toLocaleString()} rows{h.triggered_by_email ? ` · ${h.triggered_by_email}` : ''}
                      </div>
                    </div>
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClient()
  const { reload: reloadCompany } = useCompany()
  const fileRef = useRef<HTMLInputElement>(null)
  const registrationDocFileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<TabId>('profile')
  const [settings, setSettings] = useState<Settings>(defaultSettings())
  const [original, setOriginal] = useState<Settings>(defaultSettings())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingRegistrationDoc, setUploadingRegistrationDoc] = useState(false)

  // Proposal Database records — shared by the Proposal Database tab and the
  // Business Proposal section's proposal picker.
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(true)
  const [selectedProposalId, setSelectedProposalId] = useState('')
  const selectedProposal = proposals.find(p => String(p.id) === selectedProposalId) ?? null

  async function loadProposals() {
    setProposalsLoading(true)
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(getErrorMessage(error))
    else setProposals(data ?? [])
    setProposalsLoading(false)
  }

  useEffect(() => { loadProposals() }, [])

  function printProposal(p: Proposal) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(buildProposalHtml(settings, p))
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

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
    if (error) toast.error(getErrorMessage(error))
    else { toast.success('Settings saved'); setOriginal(settings); await reloadCompany() }
    setSaving(false)
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error('File must be under 2 MB'); return }
    setUploading(true)
    let publicUrl: string
    try {
      publicUrl = await uploadImageToDrive(file, { displayName: 'Company Logo', folder: 'Company' })
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to upload logo'))
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

  async function uploadRegistrationDoc(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error('File must be under 2 MB'); return }
    setUploadingRegistrationDoc(true)
    let publicUrl: string
    try {
      publicUrl = await uploadImageToDrive(file, { displayName: 'Registration Document', folder: 'Company' })
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to upload image'))
      setUploadingRegistrationDoc(false)
      return
    }
    set('registration_doc_url', publicUrl)
    await supabase.from('system_settings').upsert({ id: 1, ...settings, registration_doc_url: publicUrl })
    toast.success('Registration document uploaded')
    setUploadingRegistrationDoc(false)
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

      {tab === 'backup' && <BackupTab />}

      {tab === 'database' && (
        <ProposalDatabaseTab settings={settings} proposals={proposals} loading={proposalsLoading} onReload={loadProposals} />
      )}

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

            <CollapsibleSection title="Business Details" defaultOpen>
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
              <Separator />

            <div className="space-y-5">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Registration &amp; Compliance</p>

              <div className="space-y-2">
                <Label>Registration Document (SEC/DTI/BIR)</Label>
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.registration_doc_url ? (
                      <img src={settings.registration_doc_url} alt="registration document" className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button variant="outline" size="sm" className="gap-2 mb-1" onClick={() => registrationDocFileRef.current?.click()} disabled={uploadingRegistrationDoc}>
                      {uploadingRegistrationDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploadingRegistrationDoc ? 'Uploading…' : 'Upload Image'}
                    </Button>
                    <input ref={registrationDocFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadRegistrationDoc(e.target.files[0]) }} />
                    <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — max 2 MB. A photo/scan of your SEC/DTI/BIR certificate.</p>
                  </div>
                </div>
              </div>

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

              <div className="space-y-1.5">
                <Label>Demo Video URL</Label>
                <Input placeholder="e.g. https://www.youtube.com/watch?v=… or a video/stream link" {...S('live_video_url')} />
                <p className="text-xs text-muted-foreground">Played by the &quot;Demo Video&quot; button on the Client Dashboard. Leave blank to use the default CDSC Client Portal demo. Supports YouTube, Vimeo, Facebook, Google Drive, or a direct video link.</p>
              </div>
            </div>
            </CollapsibleSection>

            <Separator className="my-6" />

            <CollapsibleSection title="Business Profile">
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
            </CollapsibleSection>

            <Separator className="my-6" />

            <CollapsibleSection title="Business Proposal">
              <div className="space-y-1.5">
                <Label className="font-semibold">Use with a Saved Proposal</Label>
                <Select value={selectedProposalId || undefined} onValueChange={v => setSelectedProposalId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder={proposals.length === 0 ? 'No proposals yet — add one in the Proposal Database tab' : 'Select a proposal from the Proposal Database…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {proposals.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.proposal_number} — {p.client} — {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Pick a proposal saved in the Proposal Database to print it using this template.</p>
              </div>

              {selectedProposal && (
                <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Proposal No.</div>
                      <div className="text-xs font-mono font-semibold">{selectedProposal.proposal_number}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Date</div>
                      <div className="text-xs font-semibold">{selectedProposal.date ? new Date(selectedProposal.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Client</div>
                      <div className="text-xs font-semibold">{selectedProposal.client}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Title</div>
                      <div className="text-xs font-semibold">{selectedProposal.title}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</div>
                      <div className="text-xs font-semibold">{selectedProposal.amount ? `₱${selectedProposal.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[selectedProposal.status] ?? ''}`}>
                        {selectedProposal.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => printProposal(selectedProposal)} className="gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Print / Save PDF
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Label className="font-semibold">Proposal Introduction</Label>
                <Textarea rows={4} placeholder="Opening paragraph introducing your company and the purpose of this proposal…" {...S('proposal_introduction')} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Executive Summary / Why Choose Us</Label>
                <Textarea rows={5} placeholder="Concise overview of your proposal, key benefits, and value proposition…" {...S('executive_summary')} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Scope of Work</Label>
                <Textarea rows={6} placeholder="Detailed description of what will be delivered, timelines, milestones…" {...S('scope_of_work')} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Payment Schedule</Label>
                <Textarea rows={3} placeholder="e.g. 50% upon signing, 50% upon completion…" {...S('payment_schedule')} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Terms &amp; Conditions</Label>
                <Textarea rows={5} placeholder="Legal terms, warranties, liabilities, and conditions of the proposal…" {...S('terms_and_conditions')} />
              </div>

              <div className="space-y-1.5 max-w-xs">
                <Label className="font-semibold">Validity Period</Label>
                <Input placeholder="e.g. 30 days" {...S('validity_period')} />
              </div>
            </CollapsibleSection>
          </div>

          <div className="hidden lg:block">
            <LivePreview s={settings} />
          </div>
        </div>
      )}
    </div>
  )
}
