'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Website cart. Kept in the visitor's browser (localStorage) until checkout,
// which calls the submit_web_order() database function to create a DRAFT
// Sales Order for CDSC staff to price and confirm (migration 037).

export interface CartItem {
  item_id: string
  item_name: string
  unit: string | null
  image_url: string | null
  quantity: number
}

interface CartState {
  items: CartItem[]
  add: (item: Omit<CartItem, 'quantity'>, qty?: number) => void
  setQty: (item_id: string, qty: number) => void
  remove: (item_id: string) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    set => ({
      items: [],
      add: (item, qty = 1) => set(s => {
        const existing = s.items.find(i => i.item_id === item.item_id)
        if (existing) {
          return { items: s.items.map(i => i.item_id === item.item_id ? { ...i, quantity: i.quantity + qty } : i) }
        }
        return { items: [...s.items, { ...item, quantity: qty }] }
      }),
      setQty: (item_id, qty) => set(s => ({
        items: qty <= 0 ? s.items.filter(i => i.item_id !== item_id) : s.items.map(i => i.item_id === item_id ? { ...i, quantity: qty } : i),
      })),
      remove: item_id => set(s => ({ items: s.items.filter(i => i.item_id !== item_id) })),
      clear: () => set({ items: [] }),
    }),
    // Loaded after mount (see useCartHydrated) so server and first client render match.
    { name: 'cdsc-cart', skipHydration: true },
  ),
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)

/** Loads the saved cart from localStorage once mounted; returns true when ready. */
export function useCartHydrated() {
  useEffect(() => { if (!useCart.persist.hasHydrated()) useCart.persist.rehydrate() }, [])
  return useSyncExternalStore(
    cb => useCart.persist.onFinishHydration(cb),
    () => useCart.persist.hasHydrated(),
    () => false,
  )
}
