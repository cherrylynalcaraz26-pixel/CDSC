'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserPlus, MoreHorizontal, Search, Loader2, Users, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

const ROLES = [
  { value: 'super_admin',         label: 'Super-Admin',         color: 'bg-red-100 text-red-800' },
  { value: 'admin',               label: 'Admin',               color: 'bg-orange-100 text-orange-800' },
  { value: 'purchasing_officer',  label: 'Purchasing Officer',  color: 'bg-amber-100 text-amber-800' },
  { value: 'warehouse_manager',   label: 'Warehouse Manager',   color: 'bg-yellow-100 text-yellow-800' },
  { value: 'warehouse_staff',     label: 'Warehouse Staff',     color: 'bg-lime-100 text-lime-800' },
  { value: 'accounting_manager',  label: 'Accounting Manager',  color: 'bg-teal-100 text-teal-800' },
  { value: 'accounting_staff',    label: 'Accounting Staff',    color: 'bg-cyan-100 text-cyan-800' },
  { value: 'department_head',     label: 'Department Head',     color: 'bg-indigo-100 text-indigo-800' },
  { value: 'employee',            label: 'Employee',            color: 'bg-gray-100 text-gray-700' },
  { value: 'auditor',             label: 'Auditor',             color: 'bg-purple-100 text-purple-800' },
  { value: 'client',              label: 'Client',              color: 'bg-blue-100 text-blue-800' },
]

const roleOf = (v: string) => ROLES.find(r => r.value === v) ?? { label: v, color: 'bg-gray-100 text-gray-700' }

function initials(name: string | null) {
  if (!name) return '?'
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
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

interface Profile {
  id: string; full_name: string | null; email: string | null
  role: string; department: string | null; company: string | null
  status: string; created_at: string; employee_id: string | null; avatar_url: string | null
}

export default function UsersPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'employee', department: '', company: '', employee_id: '' })
  const [editForm, setEditForm] = useState({ full_name: '', role: 'employee', department: '', company: '', employee_id: '' })
  const [portalOpen, setPortalOpen] = useState(false)
  const [portalForm, setPortalForm] = useState({ email: '', full_name: '', company: '', password: '', confirmPassword: '' })
  const [portalCreating, setPortalCreating] = useState(false)
  const [showPortalPw, setShowPortalPw] = useState(false)
  const [clientNames, setClientNames] = useState<string[]>([])

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: cliData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, department, company, status, created_at, employee_id, avatar_url').order('created_at', { ascending: false }),
      supabase.from('clients').select('company_name').eq('status', 'active').order('company_name'),
    ])
    if (error) toast.error(error.message)
    else setProfiles(data ?? [])
    setClientNames((cliData ?? []).map((c: any) => c.company_name))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = profiles.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || (p.full_name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.department ?? '').toLowerCase().includes(q)
    const matchRole = !filterRole || p.role === filterRole
    return matchSearch && matchRole
  })

  async function handleInvite() {
    if (!inviteForm.email.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      const res = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name.trim() || null,
          role: inviteForm.role,
          department: inviteForm.department || null,
          company: inviteForm.company || null,
          employee_id: inviteForm.employee_id.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to invite user')
      if (json.emailSent) {
        toast.success(`Invite email sent to ${inviteForm.email}`)
      } else if (json.actionLink) {
        toast.warning('Invite email could not be sent — copy this link and send it manually.', {
          action: {
            label: 'Copy Link',
            onClick: () => { navigator.clipboard.writeText(json.actionLink) },
          },
          duration: 15000,
        })
      } else {
        toast.success(`User account created for ${inviteForm.email}`)
      }
      setInviteOpen(false)
      setInviteForm({ email: '', full_name: '', role: 'employee', department: '', company: '', employee_id: '' })
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to invite user')
    }
    setInviting(false)
  }

  async function handleCreatePortal() {
    if (!portalForm.email.trim()) { toast.error('Email is required'); return }
    if (!portalForm.password) { toast.error('Password is required'); return }
    if (portalForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (portalForm.password !== portalForm.confirmPassword) { toast.error('Passwords do not match'); return }
    setPortalCreating(true)
    try {
      const res = await fetch('/api/create-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: portalForm.email.trim().toLowerCase(),
          password: portalForm.password,
          full_name: portalForm.full_name.trim() || null,
          company: portalForm.company || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create account')
      if (portalForm.company) {
        await supabase.from('clients').update({
          portal_access: true,
          auth_user_id: json.userId ?? null,
        }).eq('company_name', portalForm.company)
      }
      toast.success(`Portal account created for ${portalForm.email}`)
      setPortalOpen(false)
      setPortalForm({ email: '', full_name: '', company: '', password: '', confirmPassword: '' })
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create portal account')
    }
    setPortalCreating(false)
  }

  function openEdit(p: Profile) {
    setEditing(p)
    setEditForm({ full_name: p.full_name ?? '', role: p.role, department: p.department ?? '', company: p.company ?? '', employee_id: p.employee_id ?? '' })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name || null,
      role: editForm.role,
      department: editForm.department || null,
      company: editForm.company || null,
      employee_id: editForm.employee_id.trim() || null,
    }).eq('id', editing.id)
    if (error) toast.error(error.message)
    else { toast.success('User updated'); setEditOpen(false); load() }
  }

  async function toggleStatus(p: Profile) {
    const next = p.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', p.id)
    if (error) toast.error(error.message)
    else { toast.success(`User ${next}`); load() }
  }

  // Stats
  const total      = profiles.length
  const active     = profiles.filter(p => p.status === 'active').length
  const admins     = profiles.filter(p => p.role === 'super_admin' || p.role === 'admin').length
  const clients    = profiles.filter(p => p.role === 'client').length
  const staff      = profiles.filter(p => !['super_admin','admin','client'].includes(p.role)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-red-600/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-none">Users</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage system access and roles</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setPortalOpen(true)} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
            <KeyRound className="h-4 w-4 mr-2" />Create Portal Account
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="bg-red-600 hover:bg-red-700">
            <UserPlus className="h-4 w-4 mr-2" />Invite User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Users', value: total,   color: '' },
          { label: 'Active',      value: active,  color: 'text-green-600' },
          { label: 'Admins',      value: admins,  color: 'text-red-600' },
          { label: 'Staff',       value: staff,   color: 'text-amber-600' },
          { label: 'Clients',     value: clients, color: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterRole || '_all'} onValueChange={v => setFilterRole(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue>{() => `Roles: ${filterRole ? roleOf(filterRole).label : 'All'}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
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
                {search || filterRole ? 'No users match your filters.' : 'No users yet. Invite someone to get started.'}
              </TableCell></TableRow>
            ) : filtered.map(p => {
              const role = roleOf(p.role)
              const isActive = (p.status ?? 'active') === 'active'
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden ${p.avatar_url ? '' : avatarColor(p.id)}`}>
                        {p.avatar_url
                          ? <img src={p.avatar_url} alt={p.full_name ?? ''} className="h-full w-full object-cover" />
                          : initials(p.full_name)}
                      </div>
                      <div>
                        <div className="font-medium text-sm leading-tight">{p.full_name ?? <span className="text-muted-foreground italic">No name</span>}</div>
                        <div className="text-xs text-muted-foreground">{p.email ?? '—'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">{p.employee_id ?? '—'}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.color}`}>{role.label}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.company ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.department ?? '—'}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleStatus(p)}>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {format(new Date(p.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEdit(p)}>Edit Role / Info</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(p)}>
                          {isActive ? 'Deactivate' : 'Activate'}
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

      {/* Create Portal Account Dialog */}
      <Dialog open={portalOpen} onOpenChange={setPortalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />Create Client Portal Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              The account will be activated immediately. Share the email and password with the client — they can log in right away without email confirmation.
            </div>
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="client@company.com" value={portalForm.email}
                onChange={e => setPortalForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="Client contact person" value={portalForm.full_name}
                onChange={e => setPortalForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={portalForm.company || '_none'} onValueChange={v => setPortalForm(f => ({ ...f, company: v === '_none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Password <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPortalPw ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={portalForm.password}
                  onChange={e => setPortalForm(f => ({ ...f, password: e.target.value }))}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPortalPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPortalPw ? <span className="text-xs">Hide</span> : <span className="text-xs">Show</span>}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password <span className="text-destructive">*</span></Label>
              <Input
                type={showPortalPw ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={portalForm.confirmPassword}
                onChange={e => setPortalForm(f => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded">ROLE</span>
              Automatically set to <strong>Client</strong> — portal access only
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPortalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePortal} disabled={portalCreating} className="bg-blue-600 hover:bg-blue-700">
              {portalCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-red-600" />Invite User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="user@cdsc.com" value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="Juan dela Cruz" value={inviteForm.full_name}
                onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input placeholder="e.g. EMP-001" value={inviteForm.employee_id}
                  onChange={e => setInviteForm(f => ({ ...f, employee_id: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="e.g. Operations" value={inviteForm.department}
                  onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v ?? 'employee' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={inviteForm.company || '_none'} onValueChange={v => setInviteForm(f => ({ ...f, company: v === '_none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              A confirmation email will be sent. The user must confirm their email and set their password before logging in.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-red-600 hover:bg-red-700">
              {inviting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="flex items-center gap-3 py-2 px-1">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${avatarColor(editing.id)}`}>
                {initials(editing.full_name)}
              </div>
              <div>
                <div className="font-medium">{editing.full_name ?? 'No name'}</div>
                <div className="text-xs text-muted-foreground">{editing.email}</div>
              </div>
            </div>
          )}
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input placeholder="e.g. EMP-001" value={editForm.employee_id} onChange={e => setEditForm(f => ({ ...f, employee_id: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v ?? 'employee' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={editForm.company || '_none'} onValueChange={v => setEditForm(f => ({ ...f, company: v === '_none' ? '' : (v ?? '') }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— None —</SelectItem>
                  {clientNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-red-600 hover:bg-red-700">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
