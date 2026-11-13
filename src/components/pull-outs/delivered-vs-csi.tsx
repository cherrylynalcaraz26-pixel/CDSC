'use client'

// Pull Outs → Delivered vs CSI. For every client, compares what CDSC delivered
// (received / partial DR Logs) with what was charged on Charge Sales Invoices,
// less what is already on a pull out. Whatever is left was delivered but never
// invoiced — the items to pull out (or to bill). Each client can get a pull out
// in one click, or all clients at once.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { useSearchContext } from '@/context/search-context'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight, Loader2, PackageOpen, Plus, RefreshCw } from 'lucide-react'

export interface BalanceItem { item_name: string; unit: string; delivered: number; charged: number; pulled: number; balance: number; drs: string[] }
export interface ClientBalance { client: string; items: BalanceItem[]; toPull: BalanceItem[] }

const q2 = (n: number) => Math.round(n * 1000) / 1000
const key = (s: string) => s.trim().toLowerCase()

export function DeliveredVsCsi({ reloadKey, onCreate, onCreateAll }: {
  reloadKey: number
  onCreate: (c: ClientBalance) => void
  onCreateAll: (cs: ClientBalance[]) => Promise<void>
}) {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [data, setData] = useState<ClientBalance[] | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [onlyToPull, setOnlyToPull] = useState(true)
  const [bulk, setBulk] = useState(false)

  useEffect(() => {
    let on = true
    type Dr = { dr_number: string; supplier_name: string | null }
    type DrItem = { dr_number: string | null; item_name: string; unit: string | null; quantity: number | null }
    type Csi = { client_name: string | null; item_name: string; unit: string | null; quantity: number | null }
    type Po = { location_name: string; status: string; items: { item_name: string; quantity: number | null }[] | null }
    Promise.all([
      fetchAllRows<Dr>((f, t) => supabase.from('dr_logs').select('id, dr_number, supplier_name').in('status', ['received', 'partial']).not('supplier_name', 'is', null).order('id').range(f, t) as unknown as PromiseLike<{ data: Dr[] | null }>),
      fetchAllRows<DrItem>((f, t) => supabase.from('dr_log_items').select('id, dr_number, item_name, unit, quantity').order('id').range(f, t) as unknown as PromiseLike<{ data: DrItem[] | null }>),
      fetchAllRows<Csi>((f, t) => supabase.from('csi_records').select('id, client_name, item_name, unit, quantity').not('client_name', 'is', null).order('id').range(f, t) as unknown as PromiseLike<{ data: Csi[] | null }>),
      fetchAllRows<Po>((f, t) => supabase.from('pull_outs').select('id, location_name, status, source_type, items:pull_out_items(item_name, quantity)').eq('source_type', 'client').neq('status', 'cancelled').order('id').range(f, t) as unknown as PromiseLike<{ data: Po[] | null }>),
    ]).then(([drs, drItems, csi, pos]) => {
      if (!on) return
      const clientOf = new Map(drs.map(d => [d.dr_number, (d.supplier_name ?? '').trim()]))
      type Acc = { name: string; unit: string; delivered: number; charged: number; pulled: number; drs: Set<string> }
      const byClient = new Map<string, { name: string; items: Map<string, Acc> }>()
      const slot = (client: string, item: string, unit: string | null) => {
        const ck = key(client)
        if (!byClient.has(ck)) byClient.set(ck, { name: client, items: new Map() })
        const c = byClient.get(ck)!
        const ik = key(item)
        if (!c.items.has(ik)) c.items.set(ik, { name: item.trim(), unit: unit ?? '', delivered: 0, charged: 0, pulled: 0, drs: new Set() })
        const a = c.items.get(ik)!
        if (!a.unit && unit) a.unit = unit
        return a
      }
      for (const it of drItems) {
        const client = it.dr_number ? clientOf.get(it.dr_number) : undefined
        if (!client) continue
        const a = slot(client, it.item_name, it.unit)
        a.delivered += Number(it.quantity) || 0
        a.drs.add(it.dr_number!)
      }
      for (const r of csi) {
        if (!r.client_name) continue
        if (!byClient.has(key(r.client_name))) continue // only clients CDSC delivered to
        slot(r.client_name, r.item_name, r.unit).charged += Number(r.quantity) || 0
      }
      for (const p of pos) {
        if (!byClient.has(key(p.location_name))) continue
        for (const i of p.items ?? []) slot(p.location_name, i.item_name, null).pulled += Number(i.quantity) || 0
      }
      const out: ClientBalance[] = [...byClient.values()].map(c => {
        const items = [...c.items.values()].map(a => ({
          item_name: a.name, unit: a.unit, delivered: q2(a.delivered), charged: q2(a.charged), pulled: q2(a.pulled),
          balance: q2(a.delivered - a.charged - a.pulled), drs: [...a.drs].sort(),
        })).sort((x, y) => x.item_name.localeCompare(y.item_name))
        return { client: c.name, items, toPull: items.filter(i => i.balance > 0) }
      }).sort((x, y) => x.client.localeCompare(y.client))
      setData(out)
    })
    return () => { on = false }
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? []).filter(c => (!onlyToPull || c.toPull.length > 0) &&
      (!q || c.client.toLowerCase().includes(q) || c.items.some(i => i.item_name.toLowerCase().includes(q))))
  }, [data, onlyToPull, query])
  const withItems = (data ?? []).filter(c => c.toPull.length > 0)

  if (!data) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const toggle = (c: string) => setOpen(s => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })
  const fmt = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 3 })

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
        <p className="mr-auto text-muted-foreground">
          <b className="text-foreground">{withItems.length}</b> client{withItems.length === 1 ? '' : 's'} with items delivered but not charged on a CSI ·{' '}
          <b className="text-foreground">{withItems.reduce((s, c) => s + c.toPull.length, 0)}</b> line{withItems.reduce((s, c) => s + c.toPull.length, 0) === 1 ? '' : 's'}
        </p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyToPull} onChange={e => setOnlyToPull(e.target.checked)} />Only clients with items to pull out</label>
        <Button className="h-9 bg-red-600 hover:bg-red-700" disabled={bulk || withItems.length === 0}
          onClick={async () => { setBulk(true); try { await onCreateAll(withItems) } finally { setBulk(false) } }}>
          {bulk ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PackageOpen className="mr-1.5 h-4 w-4" />}Create pull outs for all ({withItems.length})
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{onlyToPull ? 'Every delivered item has been charged on a CSI or is already on a pull out.' : 'No deliveries found.'}</p>
      ) : shown.map(c => {
        const isOpen = open.has(c.client)
        return (
          <div key={c.client} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => toggle(c.client)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <span className="truncate font-semibold">{c.client}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.items.length} item{c.items.length === 1 ? '' : 's'} delivered</span>
                {c.toPull.length > 0
                  ? <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{c.toPull.length} to pull out</span>
                  : <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">All charged</span>}
              </button>
              {c.toPull.length > 0 && (
                <Button variant="outline" className="h-8" onClick={() => onCreate(c)}><Plus className="mr-1 h-3.5 w-3.5" />Create Pull Out</Button>
              )}
            </div>
            {isOpen && (
              <Table containerClassName="border-t">
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Unit</TableHead>
                  <TableHead className="text-right">Delivered (DR)</TableHead>
                  <TableHead className="text-right">Charged (CSI)</TableHead>
                  <TableHead className="text-right">On pull out</TableHead>
                  <TableHead className="text-right">Not charged</TableHead>
                  <TableHead>DR No.</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {c.items.map(i => (
                    <TableRow key={i.item_name} className={i.balance > 0 ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                      <TableCell className="font-medium">{i.item_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.unit || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(i.delivered)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(i.charged)}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.pulled ? fmt(i.pulled) : '—'}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${i.balance > 0 ? 'text-amber-700' : i.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {i.balance > 0 ? fmt(i.balance) : i.balance < 0 ? `${fmt(i.balance)} (over-charged)` : '0'}
                      </TableCell>
                      <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground" title={i.drs.join(', ')}>{i.drs.join(', ') || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )
      })}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="h-3 w-3" />Not charged = delivered on received DRs − charged on CSI − already on a pull out (cancelled pull outs excluded).</p>
    </div>
  )
}
