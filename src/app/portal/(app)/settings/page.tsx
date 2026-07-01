'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, Save, Eye, EyeOff, User, Lock, Building2, Tag, Plus, Trash2,
  FileCheck2, CheckCircle2, AlertCircle, Camera, ImagePlus, X,
} from 'lucide-react'

type Tab = 'account' | 'bir' | 'department' | 'password'

export default function PortalSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [userId, setUserId] = useState('')
  const [clientId, setClientId] = useState('')
  const [tab, setTab] = useState<Tab>('account')
  const [tin, setTin] = useState('')
  const [vatType, setVatType] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [website, setWebsite] = useState('')

  // Avatar & logo
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Departments
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [newDept, setNewDept] = useState('')
  const [addingDept, setAddingDept] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setEmail(session.user.email ?? '')
      setUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).single()
      setFullName(profile?.full_name ?? '')
      setAvatarUrl((profile as any)?.avatar_url ?? null)
      const { data: clientRow } = await supabase.from('clients')
        .select('id, company_name, tin, vat_type, business_type, logo_url, website')
        .eq('auth_user_id', session.user.id).single()
      setCompanyName(clientRow?.company_name ?? '')
      setTin((clientRow as any)?.tin ?? '')
      setVatType((clientRow as any)?.vat_type ?? '')
      setBusinessType((clientRow as any)?.business_type ?? '')
      setWebsite((clientRow as any)?.website ?? '')
      const rawLogo = (clientRow as any)?.logo_url ?? null
      setLogoUrl(rawLogo ? `${rawLogo}?t=${Date.now()}` : null)
      if (clientRow?.id) {
        setClientId(clientRow.id)
        const { data: deptData } = await supabase.from('client_departments').select('id, name').eq('client_id', clientRow.id).order('name')
        setDepartments(deptData ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveProfile() {
    if (!fullName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId)
    if (!error && clientId) {
      await supabase.from('clients').update({ website: website.trim() || null }).eq('id', clientId)
    }
    if (error) toast.error(error.message)
    else toast.success('Profile updated successfully')
    setSaving(false)
  }

  async function uploadAvatar(file: File) {
    if (!userId) return
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `portal-avatars/${userId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path)
      const url = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId)
      if (dbErr) throw dbErr
      setAvatarUrl(url)
      toast.success('Avatar updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload avatar')
    }
    setUploadingAvatar(false)
  }

  async function removeAvatar() {
    if (!userId) return
    setUploadingAvatar(true)
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
    setAvatarUrl(null)
    toast.success('Avatar removed')
    setUploadingAvatar(false)
  }

  async function uploadLogo(file: File) {
    if (!clientId) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `client-logos/${clientId}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('company-assets').getPublicUrl(path)
      const url = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: dbErr } = await supabase.from('clients').update({ logo_url: urlData.publicUrl }).eq('id', clientId)
      if (dbErr) throw dbErr
      setLogoUrl(url)
      window.dispatchEvent(new CustomEvent('portal-logo-updated', { detail: { url } }))
      toast.success('Company logo updated')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload logo')
    }
    setUploadingLogo(false)
  }

  async function removeLogo() {
    if (!clientId) return
    setUploadingLogo(true)
    await supabase.from('clients').update({ logo_url: null }).eq('id', clientId)
    setLogoUrl(null)
    toast.success('Logo removed')
    setUploadingLogo(false)
  }

  async function changePassword() {
    if (!currentPw) { toast.error('Enter your current password'); return }
    if (!newPw) { toast.error('Enter a new password'); return }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setChangingPw(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPw })
    if (signInError) { toast.error('Current password is incorrect'); setChangingPw(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) toast.error(error.message)
    else {
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }
    setChangingPw(false)
  }

  async function addDepartment() {
    const name = newDept.trim()
    if (!name) { toast.error('Enter a department name'); return }
    if (!clientId) return
    if (departments.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Department already exists'); return
    }
    setAddingDept(true)
    const { data, error } = await supabase.from('client_departments').insert({ client_id: clientId, name }).select('id, name').single()
    if (error) { toast.error(error.message); setAddingDept(false); return }
    setDepartments(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewDept('')
    setAddingDept(false)
    toast.success('Department added')
  }

  async function deleteDepartment(id: string) {
    const { error } = await supabase.from('client_departments').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setDepartments(prev => prev.filter(d => d.id !== id))
    toast.success('Department removed')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const initials = (companyName || fullName).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'C'
  const birReady = !!tin.trim()

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'account',    label: 'Account',        icon: <User className="h-4 w-4" /> },
    { key: 'bir',        label: 'BIR Info',        icon: <FileCheck2 className="h-4 w-4" /> },
    { key: 'department', label: 'Department',      icon: <Tag className="h-4 w-4" /> },
    { key: 'password',   label: 'Change Password', icon: <Lock className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile, departments, and security settings.</p>
      </div>

      {/* Avatar + identity */}
      <div className="flex items-center gap-4">
        {/* Avatar circle with upload overlay */}
        <div className="relative shrink-0 group">
          <div className="h-14 w-14 rounded-full overflow-hidden bg-red-600 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-white text-lg font-bold">{initials}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {uploadingAvatar
              ? <Loader2 className="h-4 w-4 text-white animate-spin" />
              : <Camera className="h-4 w-4 text-white" />}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }}
          />
          {avatarUrl && (
            <button
              type="button"
              onClick={removeAvatar}
              className="absolute -top-1 -right-1 h-4 w-4 bg-gray-700 rounded-full flex items-center justify-center"
            >
              <X className="h-2.5 w-2.5 text-white" />
            </button>
          )}
        </div>
        <div>
          <div className="font-semibold text-gray-900">{fullName || '—'}</div>
          <div className="text-sm text-gray-500">{email}</div>
          {companyName && (
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <Building2 className="h-3 w-3" /> {companyName}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Account tab */}
      {tab === 'account' && (
        <div className="space-y-4">
          {/* Profile info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Profile Information</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <input
                value={email}
                disabled
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400">Contact CDSC to change your email address.</p>
            </div>
            {companyName && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Company</label>
                <input
                  value={companyName}
                  disabled
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Website</label>
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourwebsite.com"
                type="url"
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Profile
            </button>
          </div>

          {/* Company logo */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">Company Logo</span>
            </div>
            <p className="text-xs text-gray-400">Upload your company logo. This may appear on documents and the portal.</p>

            <div className="flex items-center gap-4">
              {/* Logo preview */}
              <div className="h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-8 w-8 text-gray-300" />
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="inline-flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    disabled={uploadingLogo}
                    className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors">
                    <X className="h-3 w-3" /> Remove logo
                  </button>
                )}
                <p className="text-xs text-gray-400">PNG, JPG, SVG up to 2MB</p>
              </div>
            </div>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = '' }}
            />
          </div>
        </div>
      )}

      {/* BIR Info tab */}
      {tab === 'bir' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-700">BIR Information</span>
            </div>
            {birReady ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> BIR Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <AlertCircle className="h-3.5 w-3.5" /> Incomplete
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">TIN (Tax Identification Number)</label>
            <input
              value={tin}
              disabled
              placeholder="Not provided"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">VAT Registration</label>
            <input
              value={vatType === 'vat' ? 'VAT Registered' : vatType === 'vat_exempt' ? 'VAT Exempt' : vatType === 'non_vat' ? 'Non-VAT' : vatType || '—'}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Business Type</label>
            <input
              value={businessType || '—'}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>

          <p className="text-xs text-gray-400">
            BIR information is managed by CDSC. Contact us if any details need to be updated.
          </p>
        </div>
      )}

      {/* Department tab */}
      {tab === 'department' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Departments</span>
          </div>
          <p className="text-xs text-gray-400">Departments appear in the Issue Item form for stock tracking.</p>

          {departments.length > 0 && (
            <div className="space-y-1.5">
              {departments.map(d => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm text-gray-800">{d.name}</span>
                  <button onClick={() => deleteDepartment(d.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {departments.length === 0 && (
            <p className="text-sm text-gray-400 italic">No departments yet. Add one below.</p>
          )}

          <div className="flex gap-2">
            <input
              value={newDept}
              onChange={e => setNewDept(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDepartment()}
              placeholder="New department name"
              className="flex-1 h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              onClick={addDepartment}
              disabled={addingDept}
              className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              {addingDept ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          </div>
        </div>
      )}

      {/* Change Password tab */}
      {tab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Change Password</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Current Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Confirm New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={changePassword}
            disabled={changingPw}
            className="inline-flex items-center gap-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {changingPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Change Password
          </button>
        </div>
      )}
    </div>
  )
}
