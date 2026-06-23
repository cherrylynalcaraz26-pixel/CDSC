'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'

export default function PortalLoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        const msg = signInError.message?.toLowerCase() ?? ''
        if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
          setError('Your account email has not been confirmed yet. Please check your inbox for a confirmation link, or contact your CDSC administrator.')
        } else if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password')) {
          setError('Incorrect email or password. Please check your credentials and try again.')
        } else if (msg.includes('user not found') || msg.includes('no user')) {
          setError('No account found with this email address. Please contact your CDSC administrator.')
        } else {
          setError(signInError.message ?? 'Sign in failed. Please try again.')
        }
        return
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      if (profile?.role !== 'client') {
        await supabase.auth.signOut()
        setError('This portal is for clients only. Please use the main application.')
        return
      }
      router.replace('/portal')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Red header band */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="relative h-16 w-16 rounded-xl overflow-hidden ring-4 ring-white/30">
                <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-cover" />
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight">CDSC Industrial Supply</h1>
            <p className="text-red-100 text-sm mt-1">Client Portal</p>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Sign in to your account</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your credentials to access your orders and catalog.</p>

            {error && (
              <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-10 pl-3 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          CDSC Industrial Supply · 113 San Isidro Sur, Sto. Tomas, Batangas
        </p>
      </div>
    </div>
  )
}
