'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Search, Loader2, MoreHorizontal, Trophy, XCircle, LayoutGrid, List, Link2, Copy, Pencil, Trash2 } from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type Stage = 'new_lead' | 'contacted' | 'proposal_sent' | 'negotiation' | 'won' | 'lost'
type Priority = 'low' | 'medium' | 'high' | 'urgent'

interface CRMLead {
  id: string
  lead_number: string
  company_name: string
  contact_person: string | null
  contact_email: string | null
  contact_phone: string | null
  product_interest: string | null
  estimated_value: number | null
  stage: Stage
  priority: Priority
  source: string | null
  assigned_to: string | null
  notes: string | null
  follow_up_date: string | null
  created_at: string
}

type FormData = {
  company_name: string
  contact_person: string
  contact_email: string
  contact_phone: string
  product_interest: string
  estimated_value: string
  stage: Stage
  priority: Priority
  source: string
  assigned_to: string
  follow_up_date: string
  notes: string
}

const STAGE_LABELS: Record<Stage, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

const STAGE_COLORS: Record<Stage, string> = {
  new_lead: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  proposal_sent: 'bg-orange-100 text-orange-800',
  negotiation: 'bg-purple-100 text-purple-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-800',
}

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const PIPELINE_STAGES: Stage[] = ['new_lead', 'contacted', 'proposal_sent', 'negotiation', 'won', 'lost']
const KANBAN_STAGES: Stage[] = ['new_lead', 'contacted', 'proposal_sent', 'negotiation']

const STAGE_CARD_COLORS: Record<Stage, string> = {
  new_lead: 'border-l-blue-500',
  contacted: 'border-l-yellow-500',
  proposal_sent: 'border-l-orange-500',
  negotiation: 'border-l-purple-500',
  won: 'border-l-green-500',
  lost: 'border-l-gray-500',
}

const emptyForm: FormData = {
  company_name: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  product_interest: '',
  estimated_value: '',
  stage: 'new_lead',
  priority: 'medium',
  source: '',
  assigned_to: '',
  follow_up_date: '',
  notes: '',
}

export default function CRMPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'table' | 'kanban'>('table')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CRMLead | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load leads')
    } else {
      setLeads(data as CRMLead[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  function openNew() {
    setEditingLead(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(lead: CRMLead) {
    setEditingLead(lead)
    setForm({
      company_name: lead.company_name,
      contact_person: lead.contact_person ?? '',
      contact_email: lead.contact_email ?? '',
      contact_phone: lead.contact_phone ?? '',
      product_interest: lead.product_interest ?? '',
      estimated_value: lead.estimated_value != null ? String(lead.estimated_value) : '',
      stage: lead.stage,
      priority: lead.priority,
      source: lead.source ?? '',
      assigned_to: lead.assigned_to ?? '',
      follow_up_date: lead.follow_up_date ?? '',
      notes: lead.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.company_name.trim()) {
      toast.error('Company Name is required')
      return
    }
    setSaving(true)
    const payload = {
      company_name: form.company_name,
      contact_person: form.contact_person || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      product_interest: form.product_interest || null,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      stage: form.stage,
      priority: form.priority,
      source: form.source || null,
      assigned_to: form.assigned_to || null,
      follow_up_date: form.follow_up_date || null,
      notes: form.notes || null,
    }
    if (editingLead) {
      const { error } = await supabase.from('crm_leads').update(payload).eq('id', editingLead.id)
      if (error) {
        toast.error('Failed to update lead')
      } else {
        toast.success('Lead updated')
        setDialogOpen(false)
        fetchLeads()
      }
    } else {
      const { error } = await supabase.from('crm_leads').insert(payload)
      if (error) {
        toast.error('Failed to create lead')
      } else {
        toast.success('Lead created')
        setDialogOpen(false)
        fetchLeads()
      }
    }
    setSaving(false)
  }

  async function deleteLead(lead: CRMLead) {
    if (!confirm(`Delete lead "${lead.company_name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('crm_leads').delete().eq('id', lead.id)
    if (error) {
      toast.error('Failed to delete lead')
    } else {
      toast.success('Lead deleted')
      fetchLeads()
    }
  }

  async function markStage(lead: CRMLead, stage: 'won' | 'lost') {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('crm_leads')
      .update({ stage, closed_date: today })
      .eq('id', lead.id)
    if (error) {
      toast.error(`Failed to mark as ${STAGE_LABELS[stage]}`)
    } else {
      toast.success(`Lead marked as ${STAGE_LABELS[stage]}`)
      fetchLeads()
    }
  }

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      l.company_name.toLowerCase().includes(q) ||
      (l.contact_person ?? '').toLowerCase().includes(q) ||
      (l.product_interest ?? '').toLowerCase().includes(q)
    const matchStage = stageFilter === 'all' || l.stage === stageFilter
    const matchPriority = priorityFilter === 'all' || l.priority === priorityFilter
    return matchSearch && matchStage && matchPriority
  })

  const stageCounts = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.stage === s).length
    return acc
  }, {} as Record<Stage, number>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inquiry / CRM Leads & Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Track inquiries, leads, and sales pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const url = `${window.location.origin}/inquiry`
              navigator.clipboard.writeText(url).then(() => {
                const el = document.getElementById('copy-feedback')
                if (el) { el.textContent = 'Copied!'; setTimeout(() => { el.textContent = 'Copy Link' }, 2000) }
              })
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Link2 className="w-4 h-4" />
            <span id="copy-feedback">Copy Link</span>
          </button>
          <a
            href="/inquiry"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Copy className="w-4 h-4" />
            Open Form
          </a>
          <Button onClick={openNew} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {PIPELINE_STAGES.map((s) => (
          <Card key={s} className={`border-l-4 ${STAGE_CARD_COLORS[s]}`}>
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{STAGE_LABELS[s]}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-2xl font-bold">{stageCounts[s]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={stageFilter} onValueChange={v => setStageFilter(v ?? 'all')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v ?? 'all')}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-md overflow-hidden">
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setView('table')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-none"
            onClick={() => setView('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'table' ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead #</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Product Interest</TableHead>
                <TableHead>Est. Value (₱)</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Follow-up Date</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-mono text-sm">{lead.lead_number}</TableCell>
                    <TableCell className="font-medium">{lead.company_name}</TableCell>
                    <TableCell>{lead.contact_person ?? '—'}</TableCell>
                    <TableCell>{lead.product_interest ?? '—'}</TableCell>
                    <TableCell>
                      {lead.estimated_value != null
                        ? `₱${lead.estimated_value.toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge className={STAGE_COLORS[lead.stage]}>
                        {STAGE_LABELS[lead.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={PRIORITY_COLORS[lead.priority]}>
                        {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.follow_up_date ?? '—'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(lead)}>
                            <Pencil className="w-4 h-4 mr-2 text-yellow-600" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => markStage(lead, 'won')}>
                            <Trophy className="w-4 h-4 mr-2 text-green-600" />
                            Mark Won
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => markStage(lead, 'lost')}>
                            <XCircle className="w-4 h-4 mr-2 text-gray-500" />
                            Mark Lost
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteLead(lead)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.map((stage) => {
            const stageLeads = filtered.filter((l) => l.stage === stage)
            return (
              <div key={stage} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{STAGE_LABELS[stage]}</h3>
                  <Badge variant="secondary">{stageLeads.length}</Badge>
                </div>
                <div className="flex flex-col gap-2 min-h-[100px]">
                  {stageLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => openEdit(lead)}
                    >
                      <CardContent className="p-3 space-y-1">
                        <p className="font-medium text-sm">{lead.company_name}</p>
                        {lead.contact_person && (
                          <p className="text-xs text-muted-foreground">{lead.contact_person}</p>
                        )}
                        {lead.product_interest && (
                          <p className="text-xs text-muted-foreground">{lead.product_interest}</p>
                        )}
                        {lead.estimated_value != null && (
                          <p className="text-xs font-semibold text-green-700">
                            ₱{lead.estimated_value.toLocaleString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'New Lead'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Company Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Person</Label>
              <Input
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                placeholder="Contact person"
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                placeholder="Email address"
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-1">
              <Label>Product Interest</Label>
              <Input
                value={form.product_interest}
                onChange={(e) => setForm({ ...form, product_interest: e.target.value })}
                placeholder="Product or service"
              />
            </div>
            <div className="space-y-1">
              <Label>Estimated Value (₱)</Label>
              <Input
                type="number"
                value={form.estimated_value}
                onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as Stage })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Input
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                placeholder="Referral, website, etc."
              />
            </div>
            <div className="space-y-1">
              <Label>Assigned To</Label>
              <Input
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                placeholder="Assigned sales rep"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Follow-up Date</Label>
              <Input
                type="date"
                value={form.follow_up_date}
                onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLead ? 'Save Changes' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
