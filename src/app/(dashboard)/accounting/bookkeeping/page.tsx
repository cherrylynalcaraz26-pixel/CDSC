import { redirect } from 'next/navigation'

// The old standalone Bookkeeping page duplicated the Bookkeeping section of
// /accounting with its own (out-of-date) ledger maths. Everything now lives in
// one place, driven by the shared ledger engine in src/lib/ledger.ts.
export default function BookkeepingRedirect() {
  redirect('/accounting?tab=bookkeeping&sub=gj')
}
