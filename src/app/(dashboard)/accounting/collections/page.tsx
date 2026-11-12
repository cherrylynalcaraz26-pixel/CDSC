import { redirect } from 'next/navigation'

// The old standalone Collections page saved receipts without journal entries.
// Collections live in Accounting → Collections (OR), which posts to the ledger.
export default function CollectionsRedirect() {
  redirect('/accounting?tab=collections')
}
