'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart, cartCount, useCartHydrated } from '@/lib/cart-store'
import { Search, ShoppingCart, Plus, Minus, Check, Package, Loader2, ArrowRight } from 'lucide-react'

interface CatalogItem {
  id: string
  item_name: string
  description: string | null
  brand: string | null
  unit_of_measure: string | null
  category: string | null
  image_url: string | null
}

/** Live item catalog from Inventory (via the public_catalog() function) with Add to Cart. */
export function ProductCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const cartReady = useCartHydrated()
  const cartAll = useCart(s => s.items)
  const cart = cartReady ? cartAll : []
  const add = useCart(s => s.add)

  useEffect(() => {
    createClient().rpc('public_catalog').then(({ data, error }) => {
      if (error) setFailed(true)
      else setItems((data ?? []) as CatalogItem[])
    })
  }, [])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set((items ?? []).map(i => i.category || 'Other'))).sort()],
    [items],
  )

  const shown = (items ?? []).filter(i => {
    if (category !== 'All' && (i.category || 'Other') !== category) return false
    const s = q.trim().toLowerCase()
    return !s || [i.item_name, i.brand, i.description, i.category].some(v => (v ?? '').toLowerCase().includes(s))
  })

  // Nothing to sell yet (or the catalog function isn't installed) → the page
  // keeps showing the category overview and sourcing CTA only.
  if (failed || (items && items.length === 0)) return null

  function addToCart(i: CatalogItem) {
    add({ item_id: i.id, item_name: i.item_name, unit: i.unit_of_measure, image_url: i.image_url }, qty[i.id] ?? 1)
    setJustAdded(i.id)
    setTimeout(() => setJustAdded(id => (id === i.id ? null : id)), 1500)
  }

  const count = cartCount(cart)

  return (
    <section id="shop" className="mx-auto max-w-screen-2xl px-6 lg:px-10 pb-4 pt-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Shop Our Catalog</h2>
          <p className="mt-2 text-sm text-cdsc-ink/60">
            Add items to your cart and send it to us — we&apos;ll confirm pricing, availability and delivery.
          </p>
        </div>
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 self-start rounded-md bg-cdsc-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-accent-dark sm:self-auto"
        >
          <ShoppingCart className="h-4 w-4" /> View Cart{count > 0 && ` (${count})`}
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cdsc-ink/40" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search items, brands…"
            className="w-full rounded-md border border-cdsc-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cdsc-accent focus:ring-2 focus:ring-cdsc-accent/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                category === c ? 'bg-cdsc-accent text-white' : 'bg-cdsc-paper text-cdsc-ink/70 hover:bg-cdsc-tint'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-cdsc-ink/40" /></div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-cdsc-ink/50">No items match your search.</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {shown.map(i => {
            const inCart = cart.find(c => c.item_id === i.id)?.quantity ?? 0
            const n = qty[i.id] ?? 1
            return (
              <div key={i.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm shadow-black/5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex aspect-square items-center justify-center bg-cdsc-paper">
                  {i.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={i.image_url} alt={i.item_name} className="h-full w-full object-cover" loading="lazy" />
                    : <Package className="h-10 w-10 text-cdsc-ink/20" />}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  {i.category && <p className="text-[10px] font-semibold uppercase tracking-wider text-cdsc-accent">{i.category}</p>}
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-cdsc-ink">{i.item_name}</h3>
                  <p className="mt-0.5 text-xs text-cdsc-ink/50">{[i.brand, i.unit_of_measure && `per ${i.unit_of_measure}`].filter(Boolean).join(' · ')}</p>
                  <div className="mt-auto pt-3">
                    <div className="mb-2 flex items-center justify-between rounded-md bg-cdsc-paper">
                      <button type="button" aria-label="Decrease" onClick={() => setQty(p => ({ ...p, [i.id]: Math.max(1, n - 1) }))} className="p-2 text-cdsc-ink/60 hover:text-cdsc-ink">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums">{n}</span>
                      <button type="button" aria-label="Increase" onClick={() => setQty(p => ({ ...p, [i.id]: n + 1 }))} className="p-2 text-cdsc-ink/60 hover:text-cdsc-ink">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToCart(i)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cdsc-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cdsc-accent-dark"
                    >
                      {justAdded === i.id ? <><Check className="h-3.5 w-3.5" /> Added</> : <><ShoppingCart className="h-3.5 w-3.5" /> Add to Cart</>}
                    </button>
                    {inCart > 0 && <p className="mt-1.5 text-center text-[11px] text-cdsc-ink/50">{inCart} in cart</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {count > 0 && (
        <Link
          href="/cart"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-cdsc-accent px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-black/20 hover:bg-cdsc-accent-dark"
        >
          <ShoppingCart className="h-4 w-4" /> {count} item{count === 1 ? '' : 's'} — Checkout <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  )
}
