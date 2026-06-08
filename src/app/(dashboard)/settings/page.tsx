'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Settings, Building2, Receipt, Bell } from 'lucide-react'

interface CompanySettings {
  company_name: string
  tin: string
  address: string
  phone: string
  email: string
  vat_registered: boolean
  default_vat_rate: number
  ewt_default_rate: number
  fiscal_year_start: string
}

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<CompanySettings>({
    company_name: 'CDSC Industrial Supply',
    tin: '',
    address: '',
    phone: '',
    email: '',
    vat_registered: true,
    default_vat_rate: 12,
    ewt_default_rate: 2,
    fiscal_year_start: '01-01',
  })
  const [saving, setSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [changingPw, setChangingPw] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: sys } = await supabase.from('system_settings').select('*').single()
      if (sys) setSettings(s => ({ ...s, ...sys }))
    }
    load()
  }, [])

  async function saveCompany() {
    setSaving(true)
    const { error } = await supabase.from('system_settings').upsert({ id: 1, ...settings })
    if (error) toast.error(error.message)
    else toast.success('Settings saved')
    setSaving(false)
  }

  async function changePassword() {
    if (!passwordForm.new || passwordForm.new !== passwordForm.confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (passwordForm.new.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setChangingPw(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.new })
    if (error) toast.error(error.message)
    else {
      toast.success('Password changed successfully')
      setPasswordForm({ current: '', new: '', confirm: '' })
    }
    setChangingPw(false)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">System and account configuration</p>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-orange-500" /> Company Information
          </CardTitle>
          <CardDescription>Basic company details used across the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input value={settings.company_name} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>TIN (Tax Identification Number)</Label>
              <Input placeholder="000-000-000-000" value={settings.tin} onChange={e => setSettings(s => ({ ...s, tin: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input placeholder="Full business address" value={settings.address} onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+63 2 8xxx xxxx" value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} />
            </div>
          </div>
          <Button onClick={saveCompany} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? 'Saving…' : 'Save Company Info'}
          </Button>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-orange-500" /> Tax Settings
          </CardTitle>
          <CardDescription>Default tax rates for BIR compliance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Default VAT Rate (%)</Label>
              <Input type="number" value={settings.default_vat_rate} onChange={e => setSettings(s => ({ ...s, default_vat_rate: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Default EWT Rate (%)</Label>
              <Input type="number" step="0.5" value={settings.ewt_default_rate} onChange={e => setSettings(s => ({ ...s, ewt_default_rate: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fiscal Year Start (MM-DD)</Label>
              <Input placeholder="01-01" value={settings.fiscal_year_start} onChange={e => setSettings(s => ({ ...s, fiscal_year_start: e.target.value }))} />
            </div>
          </div>
          <Button onClick={saveCompany} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? 'Saving…' : 'Save Tax Settings'}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-5 w-5 text-orange-500" /> Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={passwordForm.new} onChange={e => setPasswordForm(f => ({ ...f, new: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          <Button onClick={changePassword} disabled={changingPw} variant="outline">
            {changingPw ? 'Changing…' : 'Change Password'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
