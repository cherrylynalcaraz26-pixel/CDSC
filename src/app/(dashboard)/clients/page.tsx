'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Loader2, MoreHorizontal, Building2, Phone, Mail,
  MapPin, User, Pencil, Trash2, Users, CheckCircle2, XCircle,
  FileText, LayoutGrid, List, KeyRound, Copy, ShieldCheck,
} from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'

const INDUSTRIES = [
  'Construction', 'Manufacturing', 'Mining', 'Oil & Gas', 'Power & Energy',
  'Shipbuilding', 'Agriculture', 'Automotive', 'Food & Beverage', 'Retail',
  'Trading', 'Logistics', 'Government', 'Healthcare', 'Education',
  'Real Estate', 'Telecommunications', 'IT & Technology', 'Others',
]

const PAYMENT_TERMS = ['COD', '7 days', '15 days', '30 days', '45 days', '60 days', '90 days']

const BUSINESS_TYPES = [
  'Sole Proprietorship', 'Partnership', 'Corporation', 'Cooperative',
  'Government Agency', 'Non-Profit', 'Others',
]

interface Client {
  id: string
  client_number: string
  company_name: string
  contact_person: string | null
  position: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  address: string | null
  city: string | null
  province: string | null
  zip_code: string | null
  industry: string | null
  business_type: string | null
  tin: string | null
  payment_terms: string | null
  credit_limit: number | null
  notes: string | null
  status: string
  auth_user_id: string | null
  portal_access: boolean
  created_at: string
}

type FormData = {
  company_name: string
  contact_person: string
  position: string
  email: string
  phone: string
  mobile: string
  address: string
  city: string
  province: string
  zip_code: string
  industry: string
  business_type: string
  tin: string
  payment_terms: string
  credit_limit: string
  notes: string
  status: string
}

function blankForm(): FormData {
  return {
    company_name: '', contact_person: '', position: '',
    email: '', phone: '', mobile: '',
    address: '', city: '', province: '', zip_code: '',
    industry: '', business_type: '', tin: '',
    payment_terms: '30 days', credit_limit: '0', notes: '', status: 'active',
  }
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-600',
  'bg-teal-500', 'bg-blue-600', 'bg-violet-600', 'bg-pink-600',
]
function avatarColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function ClientsPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'grid'>('table')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>(blankForm())
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null)
  const [inviteClient, setInviteClient] = useState<Client | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; password: string } | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setClients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function f(k: keyof FormData, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(blankForm())
    setOpen(true)
  }

  function openEdit(c: Client) {
    setEditingId(c.id)
    setForm({
      company_name: c.company_name,
      contact_person: c.contact_person ?? '',
      position: c.position ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      mobile: c.mobile ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      province: c.province ?? '',
      zip_code: c.zip_code ?? '',
      industry: c.industry ?? '',
      business_type: c.business_type ?? '',
      tin: c.tin ?? '',
      payment_terms: c.payment_terms ?? '30 days',
      credit_limit: String(c.credit_limit ?? 0),
      notes: c.notes ?? '',
      status: c.status,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      const payload = {
        company_name: form.company_name.trim(),
        contact_person: form.contact_person || null,
        position: form.position || null,
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        address: form.address || null,
        city: form.city || null,
        province: form.province || null,
        zip_code: form.zip_code || null,
        industry: form.industry || null,
        business_type: form.business_type || null,
        tin: form.tin || null,
        payment_terms: form.payment_terms || null,
        credit_limit: parseFloat(form.credit_limit) || 0,
        notes: form.notes || null,
        status: form.status,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Client updated')
      } else {
        const { data: numData } = await supabase.rpc('next_client_number')
        const { error } = await supabase.from('clients').insert({
          ...payload,
          client_number: numData ?? `CLIENT-${Date.now()}`,
        })
        if (error) throw error
        toast.success('Client account created')
      }
      setOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save client')
    }
    setSaving(false)
  }

  async function handleDelete(c: Client) {
    const { error } = await supabase.from('clients').delete().eq('id', c.id)
    if (error) toast.error(error.message)
    else { toast.success('Client deleted'); setDeleteConfirm(null); load() }
  }

  async function toggleStatus(c: Client) {
    const next = c.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('clients').update({ status: next }).eq('id', c.id)
    if (error) toast.error(error.message)
    else { toast.success(`Client marked ${next}`); load() }
  }

  function openInvite(c: Client) {
    setInviteClient(c)
    setInviteEmail(c.email ?? '')
    setInviteResult(null)
    setInviting(false)
  }

  async function handleInvite() {
    if (!inviteClient || !inviteEmail.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!'
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail.trim().toLowerCase(),
        password: tempPassword,
        options: { data: { full_name: inviteClient.company_name, role: 'client', client_id: inviteClient.id } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteClient.contact_person || inviteClient.company_name,
          role: 'client',
        })
        await supabase.from('clients').update({
          auth_user_id: data.user.id,
          portal_access: true,
          email: inviteEmail.trim().toLowerCase(),
        }).eq('id', inviteClient.id)
      }
      setInviteResult({ email: inviteEmail.trim().toLowerCase(), password: tempPassword })
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create portal account')
    }
    setInviting(false)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_person ?? '').toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.city ?? '').toLowerCase().includes(q) ||
      c.client_number.toLowerCase().includes(q)
    const matchStatus = !filterStatus || c.status === filterStatus
    const matchIndustry = !filterIndustry || c.industry === filterIndustry
    return matchSearch && matchStatus && matchIndustry
  })

  const total = clients.length
  const active = clients.filter(c => c.status === 'active').length
  const inactive = clients.filter(c => c.status === 'inactive').length
  const industries = [...new Set(clients.map(c => c.industry).filter((x): x is string => !!x))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-600/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-none">Clients</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage client accounts and contacts</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Clients', value: total, color: '' },
          { label: 'Active', value: active, color: 'text-green-600' },
          { label: 'Inactive', value: inactive, color: 'text-gray-400' },
          { label: 'Industries', value: industries.length, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + View Toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatus || '_all'} onValueChange={(v: string | null) => setFilterStatus(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterIndustry || '_all'} onValueChange={(v: string | null) => setFilterIndustry(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All industries" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Industries</SelectItem>
            {industries.map(i => <SelectItem key={i!} value={i!}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center border rounded-md overflow-hidden">
          <button onClick={() => setView('table')} className={`px-2.5 py-1.5 ${view === 'table' ? 'bg-muted' : 'hover:bg-muted/50'}`}><List className="h-4 w-4" /></button>
          <button onClick={() => setView('grid')} className={`px-2.5 py-1.5 ${view === 'grid' ? 'bg-muted' : 'hover:bg-muted/50'}`}><LayoutGrid className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Payment Terms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {search || filterStatus || filterIndustry ? 'No clients match your filters.' : 'No clients yet. Create your first client account.'}
                </TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(c.id)}`}>
                        {initials(c.company_name)}
                      </div>
                      <div>
                        <div className="font-medium text-sm leading-tight">{c.company_name}</div>
                        <div className="text-xs text-muted-foreground">{c.client_number}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{c.contact_person ?? <span className="text-muted-foreground">—</span>}</div>
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[c.city, c.province].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.industry ?? '—'}</TableCell>
                  <TableCell className="text-sm">{c.payment_terms ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => toggleStatus(c)}>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                      {c.portal_access && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
                          <ShieldCheck className="h-3 w-3" /> Portal
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(c.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openInvite(c)}>
                          <KeyRound className="h-3.5 w-3.5 mr-2" />
                          {c.portal_access ? 'Reset Portal Access' : 'Invite to Portal'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(c)}>
                          {c.status === 'active'
                            ? <><XCircle className="h-3.5 w-3.5 mr-2" /> Deactivate</>
                            : <><CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(c)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {search || filterStatus || filterIndustry ? 'No clients match your filters.' : 'No clients yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(c => (
                <Card key={c.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColor(c.id)}`}>
                          {initials(c.company_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm leading-tight truncate">{c.company_name}</div>
                          <div className="text-xs text-muted-foreground">{c.client_number}</div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openInvite(c)}>
                            <KeyRound className="h-3.5 w-3.5 mr-2" />{c.portal_access ? 'Reset Portal Access' : 'Invite to Portal'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(c)}>
                            {c.status === 'active' ? <><XCircle className="h-3.5 w-3.5 mr-2" />Deactivate</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-2" />Activate</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(c)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {c.contact_person && (
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0" />{c.contact_person}{c.position ? ` · ${c.position}` : ''}</div>
                      )}
                      {c.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span></div>}
                      {(c.phone || c.mobile) && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{c.phone ?? c.mobile}</div>}
                      {(c.city || c.province) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{[c.city, c.province].filter(Boolean).join(', ')}</div>}
                    </div>

                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      {c.industry && <span className="text-xs text-muted-foreground truncate ml-2">{c.industry}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Client' : 'New Client Account'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Company Info */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Company Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Company Name <span className="text-red-500">*</span></Label>
                  <Input value={form.company_name} onChange={e => f('company_name', e.target.value)} placeholder="e.g. ABC Trading Corp." />
                </div>
                <div className="space-y-1.5">
                  <Label>Business Type</Label>
                  <Select value={form.business_type || '_none'} onValueChange={(v: string | null) => f('business_type', !v || v === '_none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {BUSINESS_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Select value={form.industry || '_none'} onValueChange={(v: string | null) => f('industry', !v || v === '_none' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>TIN</Label>
                  <Input value={form.tin} onChange={e => f('tin', e.target.value)} placeholder="000-000-000-000" />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: string | null) => f('status', v ?? 'active')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Person</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={form.contact_person} onChange={e => f('contact_person', e.target.value)} placeholder="Juan dela Cruz" />
                </div>
                <div className="space-y-1.5">
                  <Label>Position / Title</Label>
                  <Input value={form.position} onChange={e => f('position', e.target.value)} placeholder="Purchasing Manager" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="contact@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="(02) 8xxx-xxxx" />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile</Label>
                  <Input value={form.mobile} onChange={e => f('mobile', e.target.value)} placeholder="09xx-xxx-xxxx" />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Address</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Street Address</Label>
                  <Input value={form.address} onChange={e => f('address', e.target.value)} placeholder="Building, Street, Barangay" />
                </div>
                <div className="space-y-1.5">
                  <Label>City / Municipality</Label>
                  <Input value={form.city} onChange={e => f('city', e.target.value)} placeholder="Makati City" />
                </div>
                <div className="space-y-1.5">
                  <Label>Province</Label>
                  <Input value={form.province} onChange={e => f('province', e.target.value)} placeholder="Metro Manila" />
                </div>
                <div className="space-y-1.5">
                  <Label>ZIP Code</Label>
                  <Input value={form.zip_code} onChange={e => f('zip_code', e.target.value)} placeholder="1200" />
                </div>
              </div>
            </div>

            {/* Commercial */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commercial Terms</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Payment Terms</Label>
                  <Select value={form.payment_terms || '_none'} onValueChange={(v: string | null) => f('payment_terms', !v || v === '_none' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— None —</SelectItem>
                      {PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Credit Limit (₱)</Label>
                  <Input type="number" min="0" value={form.credit_limit} onChange={e => f('credit_limit', e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes / Remarks</Label>
              <Textarea rows={3} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Additional notes about this client..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Update Client' : 'Create Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite to Portal Dialog */}
      <Dialog open={!!inviteClient} onOpenChange={o => { if (!o) { setInviteClient(null); setInviteResult(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {inviteResult ? 'Portal Account Created' : `Invite to Client Portal`}
            </DialogTitle>
          </DialogHeader>

          {!inviteResult ? (
            <>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Create a login account for <span className="font-semibold text-foreground">{inviteClient?.company_name}</span>.
                  They will use this to log in to the Client Portal and submit purchase requests.
                </p>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="client@company.com"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteClient(null)}>Cancel</Button>
                <Button onClick={handleInvite} disabled={inviting} className="bg-blue-600 hover:bg-blue-700">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  Create Portal Account
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Account created successfully
                </div>
                <p className="text-sm text-muted-foreground">
                  Share these credentials with the client. They should change the password after first login.
                </p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Portal URL</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1">{typeof window !== 'undefined' ? window.location.origin : ''}/portal</code>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal`); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Email</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1">{inviteResult.email}</code>
                      <button onClick={() => { navigator.clipboard.writeText(inviteResult!.email); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Temporary Password</div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono flex-1 font-bold">{inviteResult.password}</code>
                      <button onClick={() => { navigator.clipboard.writeText(inviteResult!.password); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteClient(null); setInviteResult(null) }}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{deleteConfirm?.company_name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
