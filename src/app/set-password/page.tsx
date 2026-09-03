'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Loader2, Lock, CheckCircle2, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/error-message'

function SetPasswordContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)
  const [sessionValid, setSessionValid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setChecking(false); return }
      }
      const { data: { session } } = await supabase.auth.getSession()
      setSessionValid(!!session)
      setChecking(false)
    }
    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(getErrorMessage(error))
      setSaving(false)
      return
    }
    toast.success('Password set! Redirecting…')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('role').eq('id', user.id).single()
      : { data: null }
    router.push(profile?.role === 'client' ? '/portal' : '/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[linear-gradient(145deg,#b91c1c_0%,#7f1d1d_60%,#450a0a_100%)]">
      <div className="mb-6 flex flex-col items-center">
        <div className="bg-white rounded-2xl shadow-2xl px-6 py-4 mb-4">
          <div className="relative w-40 h-16">
            <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-contain" priority />
          </div>
        </div>
        <h1 className="text-white font-bold text-xl tracking-tight">CDSC Industrial Supply</h1>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        {checking ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-red-600" />
            <p className="text-sm text-gray-500">Verifying your invite link…</p>
          </div>
        ) : !sessionValid ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="text-gray-900 font-bold text-lg">Link expired or invalid</h2>
            <p className="text-sm text-gray-500">
              This invite link is no longer valid — it may have already been used or expired. Please ask your administrator to send you a new invite.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-gray-900 font-bold text-2xl">Set your password</h2>
              <p className="text-gray-500 text-sm mt-1">Choose a password to finish setting up your account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-gray-700 text-sm font-medium">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                    onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                    className="pl-9 pr-10 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-red-500/20"
                  />
                  <button type="button" onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-700 text-sm font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                    className="pl-9 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-red-500/20"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Set Password &amp; Continue</>}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 animate-spin text-red-600" /></div>}>
      <SetPasswordContent />
    </Suspense>
  )
}
