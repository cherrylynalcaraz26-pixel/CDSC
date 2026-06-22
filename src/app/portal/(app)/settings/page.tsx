'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save, Eye, EyeOff, User, Lock, Building2 } from 'lucide-react'

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

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setEmail(session.user.email ?? '')
      setUserId(session.user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single()
      setFullName(profile?.full_name ?? '')
      const { data: clientRow } = await supabase.from('clients').select('company_name').eq('auth_user_id', session.user.id).single()
      setCompanyName(clientRow?.company_name ?? '')
      setLoading(false)
    }
    load()
  }, [])

  async function saveProfile() {
    if (!fullName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', userId)
    if (error) toast.error(error.message)
    else toast.success('Profile updated successfully')
    setSaving(false)
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

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const initials = (companyName || fullName).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'C'

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile and security settings.</p>
      </div>

      {/* Account identity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-red-600 text-white text-lg font-bold flex items-center justify-center shrink-0">
            {initials}
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

        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Profile Information</span>
        </div>

        <div className="space-y-4">
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
          <button
            onClick={saveProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Profile
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Change Password</span>
        </div>

        <div className="space-y-4">
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
      </div>
    </div>
  )
}
