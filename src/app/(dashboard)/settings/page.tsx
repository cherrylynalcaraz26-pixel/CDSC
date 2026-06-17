'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Building2 } from 'lucide-react'

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

  useEffect(() => {
    async function load() {
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Company Profile</h1>
        <p className="text-muted-foreground text-sm">Manage your company information and preferences</p>
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-red-600" /> Company Profile
          </CardTitle>
          <CardDescription>Your organization's details, used on documents and reports</CardDescription>
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
          <Button onClick={saveCompany} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? 'Saving…' : 'Save Company Info'}
          </Button>
        </CardContent>
      </Card>

    </div>
  )
}
