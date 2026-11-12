import type { Metadata } from 'next'
import { CartView } from '@/components/marketing/cart-view'

export const metadata: Metadata = {
  title: 'Your Cart',
  description: 'Review your selected items and send your order to CDSC Industrial Supply.',
  robots: { index: false },
}

export default function CartPage() {
  return <CartView />
}
