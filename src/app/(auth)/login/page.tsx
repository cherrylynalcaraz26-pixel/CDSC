'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

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
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#111111] p-12">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0">
            <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-lg object-contain" priority />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">CDSC Industrial Supply</div>
            <div className="text-white/40 text-xs">Enterprise Resource Planning</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-red-500 text-sm font-semibold tracking-widest uppercase">Welcome back</div>
            <h1 className="text-4xl font-bold text-white leading-snug">
              Manage your business<br />with confidence.
            </h1>
            <p className="text-white/40 text-sm leading-relaxed max-w-sm">
              Inventory, purchasing, warehouse, BIR compliance — all in one place built for Philippine SMEs.
            </p>
          </div>

          <div className="flex gap-6">
            {[['Modules', '13+'], ['Roles', '10'], ['BIR Forms', '6']].map(([label, value]) => (
              <div key={label}>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-white/40 text-xs">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs">© {new Date().getFullYear()} CDSC Industrial Supply. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-2">
            <div className="relative h-10 w-10 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-lg object-contain" priority />
            </div>
            <div>
              <div className="font-bold text-base leading-tight">CDSC Industrial Supply</div>
              <div className="text-muted-foreground text-xs">Enterprise Resource Planning</div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
            <p className="text-muted-foreground text-sm mt-1">Enter your credentials to access the system</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@cdsc.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-medium"
              disabled={loading}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in…</> : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-muted-foreground text-xs">
            Authorized users only · CDSC Industrial Supply
          </p>
        </div>
      </div>
    </div>
  )
}
