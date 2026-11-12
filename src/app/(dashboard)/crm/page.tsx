'use client'

import { FilterBar, Segmented, FILTER_TRIGGER } from '@/components/ui/filter-bar'

import { useOpenOnNew } from '@/lib/use-open-on-new'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KpiCard } from '@/components/ui/kpi-card'
import { toast } from 'sonner'
import {
  Plus, Loader2, MoreHorizontal, Trophy, XCircle, LayoutGrid, List,
  Pencil, Trash2, Users, TrendingUp, Target,
  Phone, Mail, Calendar, Tag, ChevronRight, Building2,
} from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead
} from '@/components/ui/table'
import { useTableSort } from '@/lib/use-table-sort'
import { Textarea } from '@/components/ui/textarea'
import { NameFields } from '@/components/forms/person-address-fields'
import { emptyName, joinName, nameFromRow, nameColumns, type PersonName } from '@/lib/person-address'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { deleteWithUndo } from '@/lib/delete-with-undo'

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

const STAGE_META: Record<Stage, { label: string; color: string; bg: string; border: string; dot: string }> = {
  new_lead:      { label: 'New Lead',      color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  dot: 'bg-blue-500'   },
  contacted:     { label: 'Contacted',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-500'  },
  proposal_sent: { label: 'Proposal Sent', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',dot: 'bg-amber-500' },
  negotiation:   { label: 'Negotiation',   color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',dot: 'bg-purple-500' },
  won:           { label: 'Won',           color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500'  },
  lost:          { label: 'Lost',          color: 'text-slate-600',  bg: 'bg-slate-100', border: 'border-slate-200', dot: 'bg-slate-400'  },
}

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: 'text-slate-600',  bg: 'bg-slate-100'  },
  medium: { label: 'Medium', color: 'text-blue-700',   bg: 'bg-blue-50'    },
  high:   { label: 'High',   color: 'text-amber-700', bg: 'bg-amber-50'  },
  urgent: { label: 'Urgent', color: 'text-red-700',    bg: 'bg-red-50'     },
}

const PIPELINE_STAGES: Stage[] = ['new_lead', 'contacted', 'proposal_sent', 'negotiation', 'won', 'lost']
const KANBAN_STAGES: Stage[] = ['new_lead', 'contacted', 'proposal_sent', 'negotiation']

const emptyForm: FormData = {
  company_name: '', contact_person: '', contact_email: '', contact_phone: '',
  product_interest: '', estimated_value: '', stage: 'new_lead', priority: 'medium',
  source: '', assigned_to: '', follow_up_date: '', notes: '',
}

export default function CRMPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'table' | 'kanban'>('kanban')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CRMLead | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLead, setConfirmLead] = useState<CRMLead | null>(null)

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase.from('crm_leads').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Failed to load leads')
    else setLeads(data as CRMLead[])
    setLoading(false)
  }

  useEffect(() => { fetchLeads() }, [])

  const [contactName, setContactName] = useState<PersonName>(emptyName())
  function openNew() { setEditingLead(null); setForm(emptyForm); setContactName(emptyName()); setDialogOpen(true) }
  useOpenOnNew(openNew)

  function openEdit(lead: CRMLead) {
    setEditingLead(lead)
    setContactName(nameFromRow(lead as unknown as Record<string, unknown>, 'contact_', 'contact_person'))
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
    if (!form.company_name.trim()) { toast.error('Company Name is required'); return }
    setSaving(true)
    const payload = {
      company_name: form.company_name,
      contact_person: joinName(contactName) || null,
      ...nameColumns(contactName, 'contact_'),
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
      if (error) toast.error('Failed to update lead')
      else { toast.success('Lead updated'); setDialogOpen(false); fetchLeads() }
    } else {
      const { error } = await supabase.from('crm_leads').insert(payload)
      if (error) toast.error('Failed to create lead')
      else { toast.success('Lead created'); setDialogOpen(false); fetchLeads() }
    }
    setSaving(false)
  }

  function deleteLead(lead: CRMLead) { setConfirmLead(lead); setConfirmOpen(true) }

  async function confirmDeleteLead() {
    if (!confirmLead) return
    const lead = confirmLead
    setConfirmOpen(false); setConfirmLead(null)
    await deleteWithUndo(supabase, { table: 'crm_leads', id: lead.id, label: `lead "${lead.company_name ?? 'lead'}"`, skipConfirm: true, onChange: fetchLeads })
  }

  async function markStage(lead: CRMLead, stage: Stage) {
    const today = new Date().toISOString().split('T')[0]
    const closed = ['won', 'lost'].includes(stage) ? today : null
    const { error } = await supabase.from('crm_leads').update({ stage, ...(closed ? { closed_date: closed } : {}) }).eq('id', lead.id)
    if (error) toast.error(`Failed to update stage`)
    else { toast.success(`Stage → ${STAGE_META[stage].label}`); fetchLeads() }
  }

  function StageMenu({ lead, align = 'end' }: { lead: CRMLead; align?: 'start' | 'end' }) {
    return (
      <>
        <DropdownMenuSeparator />
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Move to Stage</div>
        {PIPELINE_STAGES.filter(s => s !== lead.stage).map(s => {
          const m = STAGE_META[s]
          return (
            <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); markStage(lead, s) }}>
              <span className={`w-2 h-2 rounded-full ${m.dot} mr-2 shrink-0`} />
              {m.label}
            </DropdownMenuItem>
          )
        })}
      </>
    )
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      l.company_name.toLowerCase().includes(q) ||
      (l.contact_person ?? '').toLowerCase().includes(q) ||
      (l.product_interest ?? '').toLowerCase().includes(q)
    // 'active' = still in the pipeline (the Pipeline Value KPI card).
    const matchStage = stageFilter === 'all' || l.stage === stageFilter || (stageFilter === 'active' && !['won', 'lost'].includes(l.stage))
    const matchPriority = priorityFilter === 'all' || l.priority === priorityFilter
    return matchSearch && matchStage && matchPriority
  })

  type LeadSortKey = 'company_name' | 'contact_person' | 'product_interest' | 'stage' | 'priority' | 'estimated_value' | 'follow_up_date'
  const { sorted: sortedLeads, sortKey: leadSortKey, sortDir: leadSortDir, onSort: onSortLead } = useTableSort<CRMLead, LeadSortKey>(filtered, (l, key) => {
    switch (key) {
      case 'company_name': return l.company_name ?? ''
      case 'contact_person': return l.contact_person ?? ''
      case 'product_interest': return l.product_interest ?? ''
      case 'stage': return l.stage ?? ''
      case 'priority': return l.priority ?? ''
      case 'estimated_value': return l.estimated_value ?? 0
      case 'follow_up_date': return l.follow_up_date ?? ''
    }
  })

  const stageCounts = PIPELINE_STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length
    return acc
  }, {} as Record<Stage, number>)

  const totalValue = leads.filter(l => l.stage === 'won').reduce((s, l) => s + (l.estimated_value ?? 0), 0)
  const pipelineValue = leads.filter(l => !['won','lost'].includes(l.stage)).reduce((s, l) => s + (l.estimated_value ?? 0), 0)

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">


      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Click a card to filter the list; click again to clear. */}
        <KpiCard label="Total Leads" value={leads.length} sub={`${stageCounts.new_lead} new`} icon={Users} tone="red"
          onClick={() => setStageFilter('all')} />
        <KpiCard label="Pipeline Value" value={fmt(pipelineValue)} sub={`${leads.filter(l => !['won', 'lost'].includes(l.stage)).length} active leads`} icon={TrendingUp} tone="blue"
          active={stageFilter === 'active'} onClick={() => setStageFilter(stageFilter === 'active' ? 'all' : 'active')} />
        <KpiCard label="Won" value={stageCounts.won} sub={`${fmt(totalValue)} closed`} icon={Trophy} tone="green"
          active={stageFilter === 'won'} onClick={() => setStageFilter(stageFilter === 'won' ? 'all' : 'won')} />
        <KpiCard label="In Negotiation" value={stageCounts.negotiation} sub={`${stageCounts.proposal_sent} proposals out`} icon={Target} tone="violet"
          active={stageFilter === 'negotiation'} onClick={() => setStageFilter(stageFilter === 'negotiation' ? 'all' : 'negotiation')} />
      </div>

      {/* Pipeline stage progress */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pipeline Stages</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PIPELINE_STAGES.map(s => {
            const m = STAGE_META[s]
            return (
              <button
                key={s}
                onClick={() => setStageFilter(stageFilter === s ? 'all' : s)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  stageFilter === s
                    ? `${m.bg} ${m.border} shadow-sm`
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                <span className={`text-xl font-bold ${stageFilter === s ? m.color : ''}`}>{stageCounts[s]}</span>
                <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filters + view toggle — shared layout (components/ui/filter-bar.tsx) */}
      <FilterBar actions={
        <Button onClick={openNew} className="h-9 bg-red-600 hover:bg-red-700 text-white gap-1.5">
          <Plus className="w-4 h-4" /> New Lead
        </Button>
      }>
        <Select value={stageFilter} onValueChange={v => setStageFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-44`}>
            <span className={stageFilter === 'all' ? 'text-muted-foreground' : ''}>
              {stageFilter === 'all' ? 'All Stages' : stageFilter === 'active' ? 'Active pipeline' : STAGE_META[stageFilter as keyof typeof STAGE_META]?.label ?? stageFilter}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            <SelectItem value="active">Active pipeline</SelectItem>
            {PIPELINE_STAGES.map(st => <SelectItem key={st} value={st}>{STAGE_META[st].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-40`}>
            {priorityFilter === 'all'
              ? <span className="text-muted-foreground">All Priorities</span>
              : <span>{PRIORITY_META[priorityFilter as Priority]?.label}</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {(['low','medium','high','urgent'] as Priority[]).map(p => (
              <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Segmented value={view} onChange={setView} options={[
          { value: 'kanban', label: 'Board', icon: LayoutGrid },
          { value: 'table', label: 'List', icon: List },
        ]} />
      </FilterBar>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === 'table' ? (

        /* ── TABLE VIEW ── */
        <div className="rounded-xl border overflow-x-clip">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableTableHead label="Company" sortKey="company_name" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Contact" sortKey="contact_person" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Product Interest" sortKey="product_interest" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Stage" sortKey="stage" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Priority" sortKey="priority" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Est. Value" sortKey="estimated_value" align="right" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <SortableTableHead label="Follow-up" sortKey="follow_up_date" className="text-xs" activeKey={leadSortKey} direction={leadSortDir} onSort={onSortLead} />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Users className="w-10 h-10 opacity-20" />
                      <div>
                        <p className="font-medium text-sm">No leads found</p>
                        <p className="text-xs mt-0.5">Add a new lead or adjust your filters</p>
                      </div>
                      <Button size="sm" onClick={openNew} className="bg-red-600 hover:bg-red-700 text-white mt-1">
                        <Plus className="w-3.5 h-3.5 mr-1" /> New Lead
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedLeads.map(lead => {
                const sm = STAGE_META[lead.stage]
                const pm = PRIORITY_META[lead.priority]
                return (
                  <TableRow key={lead.id} className="group hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(lead)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{lead.company_name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{lead.lead_number}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{lead.contact_person ?? '—'}</div>
                      {lead.contact_phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" />{lead.contact_phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                      {lead.product_interest ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${sm.bg} ${sm.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${pm.bg} ${pm.color}`}>
                        {pm.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {lead.estimated_value != null ? fmt(lead.estimated_value) : '—'}
                    </TableCell>
                    <TableCell>
                      {lead.follow_up_date ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(lead.follow_up_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEdit(lead)}>
                            <Pencil className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <StageMenu lead={lead} />
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteLead(lead)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

      ) : (

        /* ── KANBAN VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KANBAN_STAGES.map(stage => {
            const m = STAGE_META[stage]
            const stageLeads = filtered.filter(l => l.stage === stage)
            return (
              <div key={stage} className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${m.dot}`} />
                    <span className="font-semibold text-sm">{m.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${m.bg} ${m.color}`}>{stageLeads.length}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-[120px]">
                  {stageLeads.length === 0 && (
                    <div className="flex items-center justify-center h-20 rounded-xl bg-background/60 text-xs text-muted-foreground">
                      No leads
                    </div>
                  )}
                  {stageLeads.map(lead => {
                    const pm = PRIORITY_META[lead.priority]
                    return (
                      <div
                        key={lead.id}
                        className="bg-card rounded-xl p-3.5 space-y-2 shadow-sm shadow-black/5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                        onClick={() => openEdit(lead)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-tight">{lead.company_name}</p>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              onClick={e => e.stopPropagation()}
                              className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(lead) }}>
                                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                              </DropdownMenuItem>
                              <StageMenu lead={lead} />
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); deleteLead(lead) }} className="text-red-600">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {lead.contact_person && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />{lead.contact_person}
                          </div>
                        )}
                        {lead.product_interest && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="w-3 h-3" />
                            <span className="truncate">{lead.product_interest}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pm.bg} ${pm.color}`}>
                            {pm.label}
                          </span>
                          {lead.estimated_value != null && (
                            <span className="text-xs font-semibold text-green-700">{fmt(lead.estimated_value)}</span>
                          )}
                        </div>

                        {lead.follow_up_date && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground rounded-md bg-muted/60 px-2 py-1 w-fit">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {new Date(lead.follow_up_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="landscape">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingLead ? <><Pencil className="w-4 h-4" /> Edit Lead</> : <><Plus className="w-4 h-4" /> New Lead</>}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-red-500">*</span></Label>
              <Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="Company name" />
            </div>
            <NameFields className="sm:col-span-2" label="Contact Person" value={contactName} onChange={setContactName} />
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="email@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+63 9XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Product / Service Interest</Label>
              <Input value={form.product_interest} onChange={e => setForm({ ...form, product_interest: e.target.value })} placeholder="Products they're interested in" />
            </div>
            <div className="space-y-1.5">
              <Label>Estimated Value (₱)</Label>
              <Input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as Stage })}>
                <SelectTrigger>
                  {form.stage ? <span>{STAGE_META[form.stage].label}</span> : <span className="text-muted-foreground">Select stage</span>}
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_META[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v as Priority })}>
                <SelectTrigger>
                  {form.priority ? <span>{PRIORITY_META[form.priority].label}</span> : <span className="text-muted-foreground">Select priority</span>}
                </SelectTrigger>
                <SelectContent>
                  {(['low','medium','high','urgent'] as Priority[]).map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Referral, website, inquiry form…" />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Input value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="Sales rep name" />
            </div>
            <div className="space-y-1.5">
              <Label>Follow-up Date</Label>
              <Input type="date" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes…" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLead ? 'Save Changes' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <Dialog open={confirmOpen} onOpenChange={o => { if (!o) { setConfirmOpen(false); setConfirmLead(null) } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{confirmLead?.company_name}</span>? This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmLead(null) }}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmDeleteLead}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
