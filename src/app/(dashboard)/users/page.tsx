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
import { UserPlus, MoreHorizontal, Search, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const ROLES = [
  { value: 'super_admin', label: 'Super-Admin', color: 'bg-red-100 text-red-800' },
  { value: 'admin',       label: 'Admin',       color: 'bg-orange-100 text-orange-800' },
  { value: 'client',      label: 'Client',      color: 'bg-blue-100 text-blue-800' },
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
  role: string; department: string | null; status: string; created_at: string
}

export default function UsersPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'client', department: '' })
  const [editForm, setEditForm] = useState({ full_name: '', role: 'client', department: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department, status, created_at')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setProfiles(data ?? [])
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
      const { data, error } = await supabase.auth.signUp({
        email: inviteForm.email.trim().toLowerCase(),
        password: Math.random().toString(36).slice(-12) + 'A1!',
        options: { data: { full_name: inviteForm.full_name, role: inviteForm.role } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: inviteForm.email.trim().toLowerCase(),
          full_name: inviteForm.full_name || null,
          role: inviteForm.role,
          department: inviteForm.department || null,
        })
      }
      toast.success(`Invite sent to ${inviteForm.email}`)
      setInviteOpen(false)
      setInviteForm({ email: '', full_name: '', role: 'employee', department: '' })
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to invite user')
    }
    setInviting(false)
  }

  function openEdit(p: Profile) {
    setEditing(p)
    setEditForm({ full_name: p.full_name ?? '', role: p.role, department: p.department ?? '' })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name || null,
      role: editForm.role,
      department: editForm.department || null,
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
  const superAdmins = profiles.filter(p => p.role === 'super_admin').length
  const clients    = profiles.filter(p => p.role === 'client').length

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
        <Button onClick={() => setInviteOpen(true)} className="bg-red-600 hover:bg-red-700">
          <UserPlus className="h-4 w-4 mr-2" />Invite User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users',  value: total,       color: '' },
          { label: 'Active',       value: active,      color: 'text-green-600' },
          { label: 'Super-Admins', value: superAdmins, color: 'text-red-600' },
          { label: 'Clients',      value: clients,     color: 'text-blue-600' },
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
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email, department…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterRole || '_all'} onValueChange={v => setFilterRole(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All roles" /></SelectTrigger>
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
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                {search || filterRole ? 'No users match your filters.' : 'No users yet. Invite someone to get started.'}
              </TableCell></TableRow>
            ) : filtered.map(p => {
              const role = roleOf(p.role)
              const isActive = (p.status ?? 'active') === 'active'
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(p.id)}`}>
                        {initials(p.full_name)}
                      </div>
                      <div>
                        <div className="font-medium text-sm leading-tight">{p.full_name ?? <span className="text-muted-foreground italic">No name</span>}</div>
                        <div className="text-xs text-muted-foreground">{p.email ?? '—'}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.color}`}>{role.label}</span>
                  </TableCell>
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
                <Label>Role</Label>
                <Select value={inviteForm.role} onValueChange={v => setInviteForm(f => ({ ...f, role: v ?? 'client' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input placeholder="e.g. Operations" value={inviteForm.department}
                  onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))} />
              </div>
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
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v ?? 'client' }))}>
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
