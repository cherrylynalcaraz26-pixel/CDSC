'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const msg = error.message?.toLowerCase() ?? ''
        if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
          throw new Error('Your account email has not been confirmed. Please check your inbox or contact your administrator.')
        } else if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
          throw new Error('Incorrect email or password. Please try again.')
        }
        throw error
      }
      // Redirect based on role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      if (profile?.role === 'client') {
        router.push('/portal')
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)' }}>
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(234,88,12,0.18)_0%,_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(220,38,38,0.12)_0%,_transparent_50%)]" />
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 60px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 60px)' }} />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-56 h-24 mb-3">
            <Image src="/cdsc-logo.png" alt="CDSC" fill className="object-contain" priority />
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">CDSC Industrial Supply</h1>
          <p className="text-white/50 text-sm mt-0.5">Management System &amp; Client Portal</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-white font-semibold text-lg">Welcome back</h2>
            <p className="text-white/40 text-sm mt-0.5">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  type="email" placeholder="you@cdsc.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="pl-9 h-11 bg-white/8 border-white/15 text-white placeholder:text-white/25 focus:border-red-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="pl-9 pr-10 h-11 bg-white/8 border-white/15 text-white placeholder:text-white/25 focus:border-red-500"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold mt-2 shadow-lg shadow-red-900/30">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</> : 'Sign In'}
            </Button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-1.5">
          <a
            href="https://cdscindustrialsupply.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            cdscindustrialsupply.netlify.app
          </a>
          <p className="text-white/20 text-xs">
            Authorized users only · © {new Date().getFullYear()} CDSC Industrial Supply
          </p>
        </div>
      </div>
    </div>
  )
}
