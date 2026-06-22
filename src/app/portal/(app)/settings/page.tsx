'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save, Eye, EyeOff, User, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export default function PortalSettingsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPw, setChangingPw] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      setFullName(profile?.full_name ?? '')
      setLoading(false)
    }
    load()
  }, [])

  async function saveProfile() {
    if (!fullName.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId)
    if (error) toast.error(error.message)
    else toast.success('Profile updated')
    setSaving(false)
  }

  async function changePassword() {
    if (!newPw) { toast.error('Enter a new password'); return }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setChangingPw(true)
    // Re-authenticate first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPw,
    })
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
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your portal profile and password.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Profile</span>
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} disabled className="bg-muted/40 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Contact CDSC to change your email address.</p>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="bg-red-600 hover:bg-red-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Change Password</span>
          </div>
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input
              type={showPw ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
          <Button onClick={changePassword} disabled={changingPw} variant="outline">
            {changingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
            Change Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
