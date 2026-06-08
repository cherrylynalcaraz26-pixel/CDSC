'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Users, MoreHorizontal, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'purchasing_officer', label: 'Purchasing Officer' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'accounting_manager', label: 'Accounting Manager' },
  { value: 'accounting_staff', label: 'Accounting Staff' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'employee', label: 'Employee' },
  { value: 'auditor', label: 'Auditor' },
]

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800',
  admin: 'bg-orange-100 text-orange-800',
  purchasing_officer: 'bg-blue-100 text-blue-800',
  warehouse_manager: 'bg-green-100 text-green-800',
  warehouse_staff: 'bg-teal-100 text-teal-800',
  accounting_manager: 'bg-purple-100 text-purple-800',
  accounting_staff: 'bg-violet-100 text-violet-800',
  department_head: 'bg-amber-100 text-amber-800',
  employee: 'bg-gray-100 text-gray-700',
  auditor: 'bg-slate-100 text-slate-700',
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  department: string | null
  created_at: string
}

export default function UsersPage() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'employee', department: '' })
  const [editForm, setEditForm] = useState({ role: 'employee', department: '', full_name: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department, created_at')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setProfiles(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite() {
    if (!inviteForm.email.trim()) { toast.error('Email is required'); return }
    setInviting(true)
    try {
      // Use Supabase admin invite - calls the edge function / admin API via service role
      // Since we're client-side, we'll use signUp flow which sends a confirmation email
      const { data, error } = await supabase.auth.signUp({
        email: inviteForm.email.trim().toLowerCase(),
        password: Math.random().toString(36).slice(-12) + 'A1!', // temp password
        options: {
          data: {
            full_name: inviteForm.full_name,
            role: inviteForm.role,
          },
        },
      })
      if (error) throw error

      // Upsert profile manually
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
    setEditForm({ role: p.role, department: p.department ?? '', full_name: p.full_name ?? '' })
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    const { error } = await supabase.from('profiles').update({
      role: editForm.role,
      department: editForm.department || null,
      full_name: editForm.full_name || null,
    }).eq('id', editing.id)
    if (error) toast.error(error.message)
    else { toast.success('User updated'); setEditOpen(false); load() }
  }

  async function deactivate(p: Profile) {
    const { error } = await supabase.from('profiles').update({ role: 'employee' }).eq('id', p.id)
    if (error) toast.error(error.message)
    else { toast.success('Role reset to Employee'); load() }
  }

  const roleName = (r: string) => ROLES.find(x => x.value === r)?.label ?? r

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm">{profiles.length} total users</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="bg-red-600 hover:bg-red-700">
          <UserPlus className="h-4 w-4 mr-2" /> Invite User
        </Button>
      </div>

      {/* Role summary chips */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => {
          const count = profiles.filter(p => p.role === r.value).length
          if (count === 0) return null
          return (
            <span key={r.value} className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[r.value]}`}>
              {r.label}: {count}
            </span>
          )
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : profiles.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No users yet</TableCell></TableRow>
            ) : profiles.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.email ?? '—'}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[p.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {roleName(p.role)}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.department ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(p.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(p)}>Edit Role / Info</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deactivate(p)}>Reset to Employee</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-red-600" /> Invite User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email Address <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="user@cdsc.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                placeholder="Juan dela Cruz"
                value={inviteForm.full_name}
                onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
              />
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
              <Label>Department</Label>
              <Input
                placeholder="e.g. Operations, Finance"
                value={inviteForm.department}
                onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              A confirmation email will be sent to the user. They must confirm their email and set their own password before logging in.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting} className="bg-red-600 hover:bg-red-700">
              {inviting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Inviting…</> : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-red-600 hover:bg-red-700">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
