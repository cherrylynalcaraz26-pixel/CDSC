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
import {
  Building2, Upload, RotateCcw, Save, Shield, Briefcase,
  FileText, Database, User, Globe, Phone, Mail, MapPin,
  CheckCircle2, Eye, EyeOff, Loader2, Plus, Trash2, X,
} from 'lucide-react'
import Image from 'next/image'

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
    tagline: '',
    business_type: 'Trading Corporation',
    brand_positioning: '',
    mission_statement: '',
    sec_reg_no: '',
    tin: '',
    address: '',
    city: '',
    province: '',
    zip_code: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    logo_url: '',
    vat_registered: true,
    default_vat_rate: 12,
    ewt_default_rate: 2,
    fiscal_year_start: '01-01',
    industry: '',
    founded_year: '',
    employees_count: '',
    about_company: '',
    core_services: [],
    key_clients: '',
    certifications: '',
    years_of_experience: '',
    proposal_introduction: '',
    executive_summary: '',
    scope_of_work: '',
    terms_and_conditions: '',
    payment_schedule: '',
    validity_period: '30 days',
  }
}

type TabId = 'profile' | 'portfolio' | 'proposal' | 'database' | 'security'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',   label: 'Company Profile',    icon: <Building2 className="h-3.5 w-3.5" /> },
  { id: 'portfolio', label: 'Company Portfolio',  icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: 'proposal',  label: 'Business Proposal',  icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'database',  label: 'Proposal Database',  icon: <Database className="h-3.5 w-3.5" /> },
  { id: 'security',  label: 'Security',           icon: <Shield className="h-3.5 w-3.5" /> },
]

// ── Live Preview ──────────────────────────────────────────────────────────────

function LivePreview({ s }: { s: Settings }) {
  return (
    <div className="sticky top-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Live Preview</span>
        <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">● LIVE</span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3">
          <p className="text-white/50 text-[10px] uppercase tracking-widest">Document Header Preview</p>
        </div>

        <div className="p-5 border-b">
          <div className="flex items-start gap-4">
            <div className="relative h-14 w-14 rounded-lg border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
              {s.logo_url ? (
                <Image src={s.logo_url} alt="logo" fill className="object-contain p-1" />
              ) : (
                <Building2 className="h-7 w-7 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base leading-tight text-slate-800">
                {s.company_name || 'Company Name'}{s.legal_suffix ? ` ${s.legal_suffix}` : ''}
              </div>
              {s.tagline && <div className="text-xs text-slate-500 italic mt-0.5">{s.tagline}</div>}
              <div className="mt-1.5 space-y-0.5">
                {s.address && (
                  <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                    <span>{[s.address, s.city, s.province, s.zip_code].filter(Boolean).join(', ')}</span>
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

        <div className="p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Document Type</div>
              <div className="font-bold text-lg text-red-600">PURCHASE ORDER</div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <div><span className="font-medium">PO No:</span> PO-2026-00001</div>
              <div><span className="font-medium">Date:</span> Jun 19, 2026</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {[['Supplier', 'ABC Trading Corp.'], ['Payment Terms', '30 days']].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</div>
                <div className="text-xs font-medium">{v}</div>
              </div>
            ))}
          </div>
          <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
            {[['Office Supplies', '10', 'pcs', '₱500.00', '₱5,000.00'], ['IT Equipment', '2', 'units', '₱15,000.00', '₱30,000.00']].map(([item, qty, unit, price, amt]) => (
              <div key={item} className="flex justify-between text-[11px]">
                <span className="font-medium w-32 truncate">{item}</span>
                <span className="text-muted-foreground">{qty} {unit}</span>
                <span className="text-muted-foreground">{price}</span>
                <span className="font-semibold">{amt}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground text-right border-t pt-2">
            VAT Registered: {s.vat_registered ? `Yes (${s.default_vat_rate}%)` : 'No'} &nbsp;·&nbsp; EWT Default: {s.ewt_default_rate}%
          </div>
        </div>
      </div>

      <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-3">
          <p className="text-white/50 text-[10px] uppercase tracking-widest">Letterhead / Business Card</p>
        </div>
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
              {s.logo_url ? (
                <Image src={s.logo_url} alt="logo" fill className="object-contain p-1" />
              ) : (
                <Building2 className="h-5 w-5 text-white/60" />
              )}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{s.company_name || 'Company Name'}</div>
              {s.legal_suffix && <div className="text-white/50 text-[10px]">{s.legal_suffix}</div>}
            </div>
          </div>
          {s.tagline && <div className="text-white/60 text-xs italic mb-3 border-l-2 border-red-500 pl-2">{s.tagline}</div>}
          <div className="space-y-1 text-[11px] text-white/70">
            {s.address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-white/40" />{s.address}</div>}
            {s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-white/40" />{s.phone}</div>}
            {s.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-white/40" />{s.email}</div>}
          </div>
        </div>
      </div>
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
            <div className="relative h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
              {s.logo_url ? (
                <Image src={s.logo_url} alt="logo" fill className="object-contain p-1" />
              ) : (
                <Building2 className="h-6 w-6 text-white/50" />
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
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
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

// ── Portfolio Tab ─────────────────────────────────────────────────────────────

interface PortfolioTabProps {
  settings: Settings
  setSettings: React.Dispatch<React.SetStateAction<Settings>>
  onSave: () => Promise<void>
  onReset: () => void
  saving: boolean
}

function PortfolioTab({ settings, setSettings, onSave, onReset, saving }: PortfolioTabProps) {
  function setField(field: keyof Settings, value: string | CoreService[]) {
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

  return (
    <div className="space-y-0 max-w-3xl">
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h2 className="font-bold text-base uppercase tracking-wider text-slate-700">Company Portfolio</h2>
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

      <div className="space-y-6">
        <div className="space-y-1.5">
          <Label className="font-semibold">About Company</Label>
          <Textarea
            rows={5}
            placeholder="Describe your company — history, background, what you do, and what sets you apart…"
            value={settings.about_company}
            onChange={e => setField('about_company', e.target.value)}
          />
        </div>

        <div className="space-y-1.5 max-w-xs">
          <Label className="font-semibold">Years of Experience</Label>
          <Input
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={settings.years_of_experience}
            onChange={e => setField('years_of_experience', e.target.value)}
          />
        </div>

        <Separator />

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

        <Separator />

        <div className="space-y-1.5">
          <Label className="font-semibold">Key Clients</Label>
          <Textarea
            rows={3}
            placeholder="List notable clients, one per line or comma-separated…"
            value={settings.key_clients}
            onChange={e => setField('key_clients', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="font-semibold">Certifications &amp; Accreditations</Label>
          <Textarea
            rows={3}
            placeholder="e.g. ISO 9001:2015, PhilGEPS Registered, PCAB Licensed…"
            value={settings.certifications}
            onChange={e => setField('certifications', e.target.value)}
          />
        </div>
      </div>

      <div className="pt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
        <Button onClick={onSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Portfolio
        </Button>
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
                <th className="px-4 py-3"></th>
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
                    <button
                      type="button"
                      onClick={() => deleteProposal(p.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

  function reset() {
    setSettings(original)
    toast.info('Changes reset')
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('system_settings').upsert({ id: 1, ...settings })
    if (error) toast.error(error.message)
    else { toast.success('Settings saved'); setOriginal(settings) }
    setSaving(false)
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error('File must be under 2 MB'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `logos/company-logo.${ext}`
    const { error: upErr } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true })
    if (upErr) { toast.error(upErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(path)
    set('logo_url', publicUrl)
    toast.success('Logo uploaded')
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

      {tab === 'portfolio' && (
        <PortfolioTab
          settings={settings}
          setSettings={setSettings}
          onSave={save}
          onReset={reset}
          saving={saving}
        />
      )}

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
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8">
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
                  <div className="relative h-16 w-16 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                    {settings.logo_url ? (
                      <Image src={settings.logo_url} alt="logo" fill className="object-contain p-1" />
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

          <div className="hidden xl:block">
            <LivePreview s={settings} />
          </div>
        </div>
      )}
    </div>
  )
}
