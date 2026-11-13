'use client'

// 201 File → Employees: CDSC's own staff records (personal, employment,
// government IDs, address and emergency contact). Stored in `employees`
// (migration 044) — separate from login accounts in User Management.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchContext } from '@/context/search-context'
import { getErrorMessage } from '@/lib/error-message'
import { deleteWithUndo } from '@/lib/delete-with-undo'
import {
  emptyName, emptyAddress, joinName, joinAddress, nameFromRow, nameColumns, addressFromRow, addressColumns,
  type PersonName, type Address,
} from '@/lib/person-address'
import { NameFields, AddressFields } from '@/components/forms/person-address-fields'
import { KpiCard } from '@/components/ui/kpi-card'
import { FilterBar, FILTER_TRIGGER } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Users, UserCheck, CalendarClock, UserX, Plus, Pencil, Trash2, Loader2, Download } from 'lucide-react'
import { toast } from 'sonner'

const EMPLOYMENT: Record<string, string> = {
  regular: 'Regular', probationary: 'Probationary', contractual: 'Contractual', project: 'Project-based', part_time: 'Part-time',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
  on_leave: { label: 'On Leave', cls: 'bg-amber-100 text-amber-800' },
  resigned: { label: 'Resigned', cls: 'bg-slate-100 text-slate-600' },
  terminated: { label: 'Terminated', cls: 'bg-red-100 text-red-700' },
}

interface Employee {
  id: string; employee_no: string | null; full_name: string | null
  first_name: string; middle_name: string | null; last_name: string
  position: string | null; department: string | null; employment_type: string; status: string
  date_hired: string | null; date_separated: string | null; birth_date: string | null
  gender: string | null; civil_status: string | null; mobile: string | null; email: string | null
  address: string | null; tin: string | null; sss_no: string | null; philhealth_no: string | null; pagibig_no: string | null
  emergency_name: string | null; emergency_relationship: string | null; emergency_phone: string | null
  remarks: string | null
  [k: string]: unknown
}

const blank = {
  employee_no: '', position: '', department: '', employment_type: 'regular', status: 'active',
  date_hired: '', date_separated: '', birth_date: '', gender: '', civil_status: '', mobile: '', email: '',
  tin: '', sss_no: '', philhealth_no: '', pagibig_no: '',
  emergency_name: '', emergency_relationship: '', emergency_phone: '', remarks: '',
}
type Form = typeof blank

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#E8112D]">{title}</p>
      {children}
    </section>
  )
}

export function EmployeesPanel() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [rows, setRows] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [deptFilter, setDeptFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [name, setName] = useState<PersonName>(emptyName())
  const [addr, setAddr] = useState<Address>(emptyAddress())

  function fetchRows() {
    return supabase.from('employees').select('*').order('last_name').order('first_name').then(({ data, error }) => {
      setMissing(!!error)
      setRows((data ?? []) as Employee[])
      setLoading(false)
    })
  }
  useEffect(() => { fetchRows() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const departments = useMemo(() => [...new Set(rows.map(r => r.department).filter((d): d is string => !!d))].sort(), [rows])
  const counts = {
    total: rows.length,
    active: rows.filter(r => r.status === 'active').length,
    on_leave: rows.filter(r => r.status === 'on_leave').length,
    separated: rows.filter(r => r.status === 'resigned' || r.status === 'terminated').length,
  }
  const shown = rows.filter(r => {
    if (statusFilter === 'separated' ? !(r.status === 'resigned' || r.status === 'terminated') : statusFilter !== 'all' && r.status !== statusFilter) return false
    if (deptFilter !== 'all' && r.department !== deptFilter) return false
    const q = query.trim().toLowerCase()
    return !q || [r.full_name, r.employee_no, r.position, r.department, r.mobile, r.email].some(v => (v ?? '').toLowerCase().includes(q))
  })
  const toggle = (v: string) => setStatusFilter(statusFilter === v ? 'all' : v)

  function openNew() {
    setEditingId(null); setForm(blank); setName(emptyName()); setAddr(emptyAddress()); setOpen(true)
  }
  function openEdit(r: Employee) {
    setEditingId(r.id)
    const f = { ...blank }
    for (const k of Object.keys(blank) as (keyof Form)[]) f[k] = String(r[k] ?? '')
    if (!f.employment_type) f.employment_type = 'regular'
    if (!f.status) f.status = 'active'
    setForm(f)
    setName(nameFromRow(r, '', 'full_name'))
    setAddr(addressFromRow(r))
    setOpen(true)
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!name.first.trim() || !name.last.trim()) { toast.error('Enter the employee’s first and last name'); return }
    setSaving(true)
    const nullIfBlank = (v: string) => (v.trim() ? v.trim() : null)
    const payload: Record<string, unknown> = {
      ...nameColumns(name),
      full_name: joinName(name),
      ...addressColumns(addr),
      address: joinAddress(addr) || null,
      employment_type: form.employment_type,
      status: form.status,
    }
    for (const k of Object.keys(blank) as (keyof Form)[]) {
      if (k === 'employment_type' || k === 'status') continue
      payload[k] = nullIfBlank(form[k])
    }
    const { error } = editingId
      ? await supabase.from('employees').update(payload).eq('id', editingId)
      : await supabase.from('employees').insert(payload)
    if (error) toast.error(getErrorMessage(error))
    else { toast.success(editingId ? 'Employee updated' : 'Employee added'); setOpen(false); fetchRows() }
    setSaving(false)
  }

  async function remove(r: Employee) {
    await deleteWithUndo(supabase, { table: 'employees', id: r.id, label: `employee ${r.full_name ?? ''}`.trim(), onChange: () => { fetchRows() } })
  }

  function exportCsv() {
    const head = ['Employee No', 'Name', 'Position', 'Department', 'Employment', 'Status', 'Date Hired', 'Mobile', 'Email', 'TIN', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Address']
    const body = shown.map(r => [r.employee_no, r.full_name, r.position, r.department, EMPLOYMENT[r.employment_type] ?? r.employment_type, STATUS[r.status]?.label ?? r.status, r.date_hired, r.mobile, r.email, r.tin, r.sss_no, r.philhealth_no, r.pagibig_no, r.address])
    const csv = [head, ...body].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'Employees_201.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const fmtDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')

  return (
    <div className="space-y-5">
      {missing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Run database migration <b>044_employees_201_payee_details.sql</b> to start adding employees.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Employees" value={loading ? '—' : counts.total} icon={Users} tone="slate" onClick={() => setStatusFilter('all')} />
        <KpiCard label="Active" value={loading ? '—' : counts.active} icon={UserCheck} tone="green" active={statusFilter === 'active'} onClick={() => toggle('active')} />
        <KpiCard label="On Leave" value={loading ? '—' : counts.on_leave} icon={CalendarClock} tone="amber" active={statusFilter === 'on_leave'} onClick={() => toggle('on_leave')} />
        <KpiCard label="Resigned / Terminated" value={loading ? '—' : counts.separated} icon={UserX} tone="red" active={statusFilter === 'separated'} onClick={() => toggle('separated')} />
      </div>

      <FilterBar actions={<>
        <span className="text-xs text-muted-foreground">{shown.length} employee{shown.length === 1 ? '' : 's'}</span>
        <Button variant="outline" className="h-9" onClick={exportCsv} disabled={shown.length === 0}><Download className="mr-1.5 h-4 w-4" />Export CSV</Button>
        <Button className="h-9 bg-red-600 hover:bg-red-700" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add Employee</Button>
      </>}>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-44`}>
            <span>{statusFilter === 'all' ? 'All Status' : statusFilter === 'separated' ? 'Resigned / Terminated' : STATUS[statusFilter]?.label}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={v => setDeptFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-48`}><span>{deptFilter === 'all' ? 'All Departments' : deptFilter}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-28">Employee No.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Employment</TableHead>
            <TableHead>Date Hired</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-20" />
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : shown.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">{rows.length ? 'No employees match the filters.' : 'No employees yet — click Add Employee.'}</TableCell></TableRow>
            ) : shown.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-red-50/40" onClick={() => openEdit(r)}>
                <TableCell className="font-mono text-xs font-semibold text-red-600">{r.employee_no ?? '—'}</TableCell>
                <TableCell className="font-medium">{r.full_name ?? `${r.first_name} ${r.last_name}`}</TableCell>
                <TableCell className="text-sm">{r.position ?? '—'}</TableCell>
                <TableCell className="text-sm">{r.department ?? '—'}</TableCell>
                <TableCell className="text-sm">{EMPLOYMENT[r.employment_type] ?? r.employment_type}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.date_hired)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{[r.mobile, r.email].filter(Boolean).join(' · ') || '—'}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status]?.cls ?? ''}`}>{STATUS[r.status]?.label ?? r.status}</span></TableCell>
                <TableCell onClick={e => e.stopPropagation()} className="text-right">
                  <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Delete" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Employee — 201 File' : 'Add Employee — 201 File'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Section title="Personal information">
              <NameFields value={name} onChange={setName} required />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Birth date</Label><Input type="date" value={form.birth_date} onChange={set('birth_date')} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select value={form.gender || '_'} onValueChange={v => setForm(f => ({ ...f, gender: v === '_' || !v ? '' : v }))}>
                    <SelectTrigger className="h-9"><span>{form.gender || 'Select…'}</span></SelectTrigger>
                    <SelectContent><SelectItem value="_">—</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Civil status</Label>
                  <Select value={form.civil_status || '_'} onValueChange={v => setForm(f => ({ ...f, civil_status: v === '_' || !v ? '' : v }))}>
                    <SelectTrigger className="h-9"><span>{form.civil_status || 'Select…'}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">—</SelectItem>
                      {['Single', 'Married', 'Widowed', 'Separated'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>

            <Section title="Employment">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Employee No.</Label><Input value={form.employee_no} onChange={set('employee_no')} placeholder="Auto (EMP-00001)" /></div>
                <div className="space-y-1"><Label className="text-xs">Position</Label><Input value={form.position} onChange={set('position')} placeholder="e.g. Warehouse Staff" /></div>
                <div className="space-y-1"><Label className="text-xs">Department</Label><Input value={form.department} onChange={set('department')} list="emp-departments" placeholder="e.g. Warehouse" /></div>
                <datalist id="emp-departments">{departments.map(d => <option key={d} value={d} />)}</datalist>
                <div className="space-y-1">
                  <Label className="text-xs">Employment type</Label>
                  <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v ?? 'regular' }))}>
                    <SelectTrigger className="h-9"><span>{EMPLOYMENT[form.employment_type]}</span></SelectTrigger>
                    <SelectContent>{Object.entries(EMPLOYMENT).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'active' }))}>
                    <SelectTrigger className="h-9"><span>{STATUS[form.status]?.label}</span></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Date hired</Label><Input type="date" value={form.date_hired} onChange={set('date_hired')} /></div>
                {(form.status === 'resigned' || form.status === 'terminated') && (
                  <div className="space-y-1"><Label className="text-xs">Date separated</Label><Input type="date" value={form.date_separated} onChange={set('date_separated')} /></div>
                )}
              </div>
            </Section>

            <Section title="Government IDs">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1"><Label className="text-xs">TIN</Label><Input value={form.tin} onChange={set('tin')} placeholder="000-000-000-000" /></div>
                <div className="space-y-1"><Label className="text-xs">SSS No.</Label><Input value={form.sss_no} onChange={set('sss_no')} /></div>
                <div className="space-y-1"><Label className="text-xs">PhilHealth No.</Label><Input value={form.philhealth_no} onChange={set('philhealth_no')} /></div>
                <div className="space-y-1"><Label className="text-xs">Pag-IBIG No.</Label><Input value={form.pagibig_no} onChange={set('pagibig_no')} /></div>
              </div>
            </Section>

            <Section title="Contact & address">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={set('mobile')} placeholder="09xx xxx xxxx" /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
              </div>
              <AddressFields value={addr} onChange={setAddr} />
            </Section>

            <Section title="Emergency contact">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={form.emergency_name} onChange={set('emergency_name')} /></div>
                <div className="space-y-1"><Label className="text-xs">Relationship</Label><Input value={form.emergency_relationship} onChange={set('emergency_relationship')} /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.emergency_phone} onChange={set('emergency_phone')} /></div>
              </div>
            </Section>

            <div className="space-y-1"><Label className="text-xs">Remarks</Label><Textarea rows={2} value={form.remarks} onChange={set('remarks')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{editingId ? 'Save Changes' : 'Add Employee'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
