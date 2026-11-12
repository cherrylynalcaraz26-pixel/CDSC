// Global "Saving… / Adding… / Deleting…" activity tracker.
//
// Every Supabase request made by the browser client goes through
// `trackedFetch` (wired in lib/supabase/client.ts). Writes to the database
// (POST / PATCH / DELETE on /rest/v1) are counted here, and the
// <ActivityIndicator /> mounted in the root layout shows a small status pill
// while they run, then a brief "Saved ✓" / "Deleted ✓" / "Failed" result.
// Reads (GET, and read-only RPCs) are ignored so browsing never flashes it.

export type ActivityKind = 'adding' | 'saving' | 'deleting'
export type ActivityState =
  | { phase: 'idle' }
  | { phase: 'busy'; kind: ActivityKind; count: number }
  | { phase: 'done'; kind: ActivityKind; ok: boolean }

const READ_ONLY_RPC = new Set(['public_catalog', 'next_client_number', 'get_supabase_storage_stats'])

let pending: { kind: ActivityKind }[] = []
let state: ActivityState = { phase: 'idle' } as ActivityState
let lastKind: ActivityKind = 'saving'
let failed = false
let doneTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit(next: ActivityState) {
  state = next
  listeners.forEach(l => l())
}

export function subscribeActivity(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
export const getActivity = () => state
const IDLE: ActivityState = { phase: 'idle' }
export const getServerActivity = (): ActivityState => IDLE

// Deleting outranks adding, which outranks saving, when several run at once.
const RANK: Record<ActivityKind, number> = { saving: 0, adding: 1, deleting: 2 }

function begin(kind: ActivityKind) {
  const token = { kind }
  pending.push(token)
  if (doneTimer) { clearTimeout(doneTimer); doneTimer = null }
  if (pending.length === 1) failed = false
  lastKind = pending.reduce((k, p) => (RANK[p.kind] > RANK[k] ? p.kind : k), pending[0].kind)
  emit({ phase: 'busy', kind: lastKind, count: pending.length })
  return (ok: boolean) => {
    pending = pending.filter(p => p !== token)
    if (!ok) failed = true
    if (pending.length) {
      emit({ phase: 'busy', kind: lastKind, count: pending.length })
      return
    }
    emit({ phase: 'done', kind: lastKind, ok: !failed })
    doneTimer = setTimeout(() => emit(IDLE), failed ? 2600 : 1400)
  }
}

function classify(input: RequestInfo | URL, init?: RequestInit): ActivityKind | null {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.includes('/rest/v1/')) return null
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  if (method === 'DELETE') return 'deleting'
  if (method === 'PATCH' || method === 'PUT') return 'saving'
  if (method !== 'POST') return null
  const rpc = url.match(/\/rest\/v1\/rpc\/([\w]+)/)
  if (rpc) return READ_ONLY_RPC.has(rpc[1]) ? null : 'saving'
  const headers = new Headers(init?.headers)
  return /resolution=merge-duplicates/.test(headers.get('Prefer') ?? '') ? 'saving' : 'adding'
}

export const trackedFetch: typeof fetch = async (input, init) => {
  const kind = typeof window === 'undefined' ? null : classify(input, init)
  if (!kind) return fetch(input, init)
  const end = begin(kind)
  try {
    const res = await fetch(input, init)
    end(res.ok)
    return res
  } catch (err) {
    end(false)
    throw err
  }
}
