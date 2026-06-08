'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Plus, Shield } from 'lucide-react'

const roles = [
  { role: 'Super Admin', users: 1, description: 'Full system access, all modules', color: 'destructive' },
  { role: 'Admin', users: 2, description: 'Manage all modules except system config', color: 'default' },
  { role: 'Purchasing Officer', users: 3, description: 'PR, PO, supplier management', color: 'default' },
  { role: 'Warehouse Manager', users: 2, description: 'Receiving, transfers, adjustments', color: 'default' },
  { role: 'Warehouse Staff', users: 5, description: 'Receiving, issuance only', color: 'secondary' },
  { role: 'Accounting Manager', users: 1, description: 'Full accounting, BIR filing', color: 'default' },
  { role: 'Accounting Staff', users: 3, description: 'View accounting, generate reports', color: 'secondary' },
  { role: 'Department Head', users: 8, description: 'Approve dept PRs, view reports', color: 'secondary' },
  { role: 'Employee', users: 45, description: 'Create requests, view own data', color: 'outline' },
  { role: 'Auditor', users: 2, description: 'Read-only access to all reports', color: 'outline' },
]

const permissionsMatrix = [
  { module: 'Dashboard', super_admin: '✓', admin: '✓', purchasing: 'View', warehouse_mgr: 'View', warehouse_staff: 'Limited', acctg_mgr: 'View', acctg_staff: 'View', dept_head: 'Limited', employee: 'Limited', auditor: 'View' },
  { module: 'Suppliers', super_admin: '✓', admin: '✓', purchasing: '✓', warehouse_mgr: 'View', warehouse_staff: '—', acctg_mgr: 'View', acctg_staff: 'View', dept_head: '—', employee: '—', auditor: 'View' },
  { module: 'Item Master', super_admin: '✓', admin: '✓', purchasing: 'View', warehouse_mgr: '✓', warehouse_staff: 'View', acctg_mgr: 'View', acctg_staff: 'View', dept_head: 'View', employee: 'View', auditor: 'View' },
  { module: 'Purchase Requests', super_admin: '✓', admin: '✓', purchasing: '✓', warehouse_mgr: 'View', warehouse_staff: '—', acctg_mgr: 'View', acctg_staff: '—', dept_head: 'Approve', employee: 'Create', auditor: 'View' },
  { module: 'Purchase Orders', super_admin: '✓', admin: '✓', purchasing: '✓', warehouse_mgr: 'View', warehouse_staff: '—', acctg_mgr: 'View', acctg_staff: 'View', dept_head: '—', employee: '—', auditor: 'View' },
  { module: 'Receiving', super_admin: '✓', admin: '✓', purchasing: 'View', warehouse_mgr: '✓', warehouse_staff: 'Create', acctg_mgr: 'View', acctg_staff: 'View', dept_head: '—', employee: '—', auditor: 'View' },
  { module: 'Warehouse', super_admin: '✓', admin: '✓', purchasing: '—', warehouse_mgr: '✓', warehouse_staff: 'Limited', acctg_mgr: 'View', acctg_staff: '—', dept_head: '—', employee: '—', auditor: 'View' },
  { module: 'Assets', super_admin: '✓', admin: '✓', purchasing: '—', warehouse_mgr: '✓', warehouse_staff: 'View', acctg_mgr: 'View', acctg_staff: 'View', dept_head: 'View', employee: 'View Own', auditor: 'View' },
  { module: 'BIR Compliance', super_admin: '✓', admin: 'View', purchasing: '—', warehouse_mgr: '—', warehouse_staff: '—', acctg_mgr: '✓', acctg_staff: 'View', dept_head: '—', employee: '—', auditor: 'View' },
  { module: 'Reports', super_admin: '✓', admin: '✓', purchasing: 'Purch', warehouse_mgr: 'WH', warehouse_staff: '—', acctg_mgr: 'All', acctg_staff: 'Acctg', dept_head: 'Dept', employee: '—', auditor: 'All' },
  { module: 'User Management', super_admin: '✓', admin: 'View', purchasing: '—', warehouse_mgr: '—', warehouse_staff: '—', acctg_mgr: '—', acctg_staff: '—', dept_head: '—', employee: '—', auditor: '—' },
]

function PermCell({ value }: { value: string }) {
  if (value === '✓') return <span className="text-green-600 font-bold">✓</span>
  if (value === '—') return <span className="text-muted-foreground text-xs">—</span>
  return <span className="text-xs text-blue-600">{value}</span>
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Users & Permissions</h2>
          <p className="text-muted-foreground text-sm">Manage user accounts and role-based access control</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" />Invite User</Button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {roles.slice(0, 5).map(r => (
          <Card key={r.role}>
            <CardContent className="pt-4 pb-3">
              <Badge variant={r.color as 'default' | 'secondary' | 'destructive' | 'outline'} className="text-xs mb-2">{r.role}</Badge>
              <div className="text-2xl font-bold">{r.users}</div>
              <div className="text-xs text-muted-foreground">{r.description}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" />Role Permissions Matrix</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Module</TableHead>
                <TableHead className="text-center text-xs">Super Admin</TableHead>
                <TableHead className="text-center text-xs">Admin</TableHead>
                <TableHead className="text-center text-xs">Purchasing</TableHead>
                <TableHead className="text-center text-xs">WH Mgr</TableHead>
                <TableHead className="text-center text-xs">WH Staff</TableHead>
                <TableHead className="text-center text-xs">Acctg Mgr</TableHead>
                <TableHead className="text-center text-xs">Acctg Staff</TableHead>
                <TableHead className="text-center text-xs">Dept Head</TableHead>
                <TableHead className="text-center text-xs">Employee</TableHead>
                <TableHead className="text-center text-xs">Auditor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionsMatrix.map(row => (
                <TableRow key={row.module}>
                  <TableCell className="font-medium text-sm">{row.module}</TableCell>
                  <TableCell className="text-center"><PermCell value={row.super_admin} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.admin} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.purchasing} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.warehouse_mgr} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.warehouse_staff} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.acctg_mgr} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.acctg_staff} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.dept_head} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.employee} /></TableCell>
                  <TableCell className="text-center"><PermCell value={row.auditor} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
