'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart, cartCount, useCartHydrated } from '@/lib/cart-store'
import { getErrorMessage } from '@/lib/error-message'
import { Minus, Plus, Trash2, Package, ShoppingCart, CheckCircle2, Loader2, ArrowLeft, Send } from 'lucide-react'

const inputClass =
  'w-full rounded-md border border-cdsc-line bg-white px-3 py-2.5 text-sm text-cdsc-ink outline-none transition focus:border-cdsc-accent focus:ring-2 focus:ring-cdsc-accent/20'

const EMPTY = {
  company_name: '', first_name: '', middle_name: '', last_name: '',
  email: '', phone: '',
  address_no: '', street: '', barangay: '', municipality: '', city: '',
  notes: '',
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1.5 block text-xs font-semibold text-cdsc-ink/70">
        {label}{required && <span className="text-cdsc-accent"> *</span>}
      </span>
      {children}
    </label>
  )
}

export function CartView() {
  const items = useCart(s => s.items)
  const setQty = useCart(s => s.setQty)
  const remove = useCart(s => s.remove)
  const clear = useCart(s => s.clear)
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // The cart lives in localStorage — wait for it before rendering to avoid a flash of "empty".
  const hydrated = useCartHydrated()

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    const { data, error } = await createClient().rpc('submit_web_order', {
      p_customer: form,
      p_items: items.map(i => ({ item_id: i.item_id, quantity: i.quantity })),
    })
    setSending(false)
    if (error) { setError(getErrorMessage(error, 'Could not send your order. Please try again.')); return }
    clear()
    setDone((data as { so_number?: string } | null)?.so_number ?? 'received')
  }

  if (done) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-cdsc-accent" />
        <h1 className="mt-5 text-2xl font-semibold text-cdsc-ink">Order sent — thank you!</h1>
        <p className="mt-3 text-sm leading-relaxed text-cdsc-ink/65">
          {done !== 'received' && <>Your reference number is <strong className="text-cdsc-ink">{done}</strong>. </>}
          Our team will review your order and contact you to confirm pricing, availability and delivery.
        </p>
        <Link href="/products" className="mt-8 inline-flex items-center gap-2 rounded-md bg-cdsc-accent px-6 py-3 text-sm font-semibold text-white hover:bg-cdsc-accent-dark">
          Continue Shopping
        </Link>
      </section>
    )
  }

  if (!hydrated) {
    return <div className="py-32 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-cdsc-ink/40" /></div>
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl px-6 py-24 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-cdsc-ink/25" />
        <h1 className="mt-5 text-2xl font-semibold text-cdsc-ink">Your cart is empty</h1>
        <p className="mt-3 text-sm text-cdsc-ink/60">Browse our catalog and add the items your business needs.</p>
        <Link href="/products#shop" className="mt-8 inline-flex items-center gap-2 rounded-md bg-cdsc-accent px-6 py-3 text-sm font-semibold text-white hover:bg-cdsc-accent-dark">
          Browse Products
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <Link href="/products#shop" className="inline-flex items-center gap-1.5 text-sm text-cdsc-ink/60 hover:text-cdsc-accent">
        <ArrowLeft className="h-4 w-4" /> Continue shopping
      </Link>
      <h1 className="mt-3 text-3xl font-semibold text-cdsc-ink">Your Cart</h1>
      <p className="mt-1 text-sm text-cdsc-ink/60">
        {cartCount(items)} item{cartCount(items) === 1 ? '' : 's'} · Prices and availability are confirmed by our team after you send your order.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* Items */}
        <ul className="space-y-3">
          {items.map(i => (
            <li key={i.item_id} className="flex items-center gap-4 rounded-xl bg-white p-3 shadow-sm shadow-black/5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cdsc-paper">
                {i.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={i.image_url} alt="" className="h-full w-full object-cover" />
                  : <Package className="h-6 w-6 text-cdsc-ink/25" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-cdsc-ink">{i.item_name}</p>
                {i.unit && <p className="text-xs text-cdsc-ink/50">per {i.unit}</p>}
              </div>
              <div className="flex items-center rounded-md bg-cdsc-paper">
                <button type="button" aria-label="Decrease" onClick={() => setQty(i.item_id, i.quantity - 1)} className="p-2 text-cdsc-ink/60 hover:text-cdsc-ink"><Minus className="h-3.5 w-3.5" /></button>
                <input
                  aria-label="Quantity" inputMode="numeric" value={i.quantity}
                  onChange={e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); if (!Number.isNaN(n)) setQty(i.item_id, Math.min(n, 100000)) }}
                  className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
                />
                <button type="button" aria-label="Increase" onClick={() => setQty(i.item_id, i.quantity + 1)} className="p-2 text-cdsc-ink/60 hover:text-cdsc-ink"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <button type="button" aria-label={`Remove ${i.item_name}`} onClick={() => remove(i.item_id)} className="p-2 text-cdsc-ink/40 hover:text-cdsc-accent">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* Checkout */}
        <form onSubmit={submit} className="h-fit space-y-4 rounded-2xl bg-cdsc-paper p-6 lg:sticky lg:top-28">
          <h2 className="text-lg font-semibold text-cdsc-ink">Your Details</h2>
          <Field label="Company / Business Name" required>
            <input required value={form.company_name} onChange={set('company_name')} className={inputClass} autoComplete="organization" />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="First Name" required><input required value={form.first_name} onChange={set('first_name')} className={inputClass} autoComplete="given-name" /></Field>
            <Field label="Middle Name"><input value={form.middle_name} onChange={set('middle_name')} className={inputClass} autoComplete="additional-name" /></Field>
            <Field label="Last Name" required><input required value={form.last_name} onChange={set('last_name')} className={inputClass} autoComplete="family-name" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Email" required><input required type="email" value={form.email} onChange={set('email')} className={inputClass} autoComplete="email" /></Field>
            <Field label="Contact Number" required><input required value={form.phone} onChange={set('phone')} className={inputClass} autoComplete="tel" /></Field>
          </div>
          <p className="pt-1 text-xs font-semibold uppercase tracking-wider text-cdsc-ink/50">Delivery Address</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Address No."><input value={form.address_no} onChange={set('address_no')} className={inputClass} /></Field>
            <Field label="Street" className="col-span-2"><input value={form.street} onChange={set('street')} className={inputClass} autoComplete="address-line1" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Barangay"><input value={form.barangay} onChange={set('barangay')} className={inputClass} /></Field>
            <Field label="Municipality"><input value={form.municipality} onChange={set('municipality')} className={inputClass} /></Field>
            <Field label="City / Province"><input value={form.city} onChange={set('city')} className={inputClass} /></Field>
          </div>
          <Field label="Notes (delivery date, specs, brand preference…)">
            <textarea rows={3} value={form.notes} onChange={set('notes')} className={inputClass} />
          </Field>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-cdsc-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cdsc-accent-dark disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Order
          </button>
          <p className="text-center text-[11px] text-cdsc-ink/50">No payment is taken online. We&apos;ll send you a confirmation and quotation.</p>
        </form>
      </div>
    </section>
  )
}
