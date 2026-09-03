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
import { getErrorMessage } from '@/lib/error-message'

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
      if (profile?.role === 'client' || profile?.role === 'vendor') {
        router.push('/portal')
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, #b91c1c 0%, #7f1d1d 60%, #450a0a 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 1px,transparent 24px)' }} />
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 mb-8 w-72">
            <div className="relative w-full h-28">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-white font-bold text-3xl tracking-tight mb-2">CDSC Industrial Supply</h1>
          <p className="text-red-200 text-base">Management System &amp; Client Portal</p>
        </div>
        <p className="absolute bottom-6 text-red-300/50 text-xs">
          © 2020 CDSC Industrial Supply · Authorized users only
        </p>
      </div>

      {/* Right panel — form (red background on mobile, like the desktop branding panel) */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[linear-gradient(145deg,#b91c1c_0%,#7f1d1d_60%,#450a0a_100%)] lg:bg-none lg:bg-gray-50">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex flex-col items-center">
          <div className="bg-white rounded-2xl shadow-2xl px-6 py-4 mb-4">
            <div className="relative w-48 h-20">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-contain" priority />
            </div>
          </div>
          <h1 className="text-white font-bold text-xl tracking-tight">CDSC Industrial Supply</h1>
          <p className="text-red-200 text-sm mt-0.5">Management System &amp; Client Portal</p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 lg:bg-transparent lg:rounded-none lg:shadow-none lg:p-0">
          <div className="mb-8">
            <h2 className="text-gray-900 font-bold text-2xl">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email" placeholder="you@cdsc.com" value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email"
                  className="pl-9 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-red-500/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
                  className="pl-9 pr-10 h-11 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-red-500 focus:ring-red-500/20"
                />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading}
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-sm">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</> : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 space-y-1.5 text-center">
            <a
              href="https://cdscindustrialsupply.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              cdscindustrialsupply.netlify.app
            </a>
            <p className="text-gray-300 text-xs">
              Authorized users only · © 2020 CDSC Industrial Supply
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
