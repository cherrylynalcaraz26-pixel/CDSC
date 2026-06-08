'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Star, TrendingUp, ThumbsUp, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface CSIRecord {
  id: string
  client_name: string
  date: string
  category: string
  rating: number
  feedback: string | null
  status: string
  created_at: string
}

const CATEGORIES = ['Delivery Speed', 'Product Quality', 'Customer Service', 'Pricing', 'Order Accuracy', 'Overall Experience']

function StarRating({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`h-5 w-5 ${n <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  )
}

export default function CSIMonitoringPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<CSIRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ client_name: '', category: 'Overall Experience', rating: 5, feedback: '' })

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('csi_records')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setRecords(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    if (!form.client_name.trim()) { toast.error('Client name required'); return }
    setSaving(true)
    const { error } = await supabase.from('csi_records').insert({
      client_name: form.client_name.trim(),
      category: form.category,
      rating: form.rating,
      feedback: form.feedback || null,
      date: new Date().toISOString().split('T')[0],
      status: 'received',
    })
    if (error) {
      // Table might not exist yet — guide user
      if (error.code === '42P01') {
        toast.error('CSI table not set up. Contact your administrator.')
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success('Feedback recorded')
      setOpen(false)
      setForm({ client_name: '', category: 'Overall Experience', rating: 5, feedback: '' })
      load()
    }
    setSaving(false)
  }

  const avgRating = records.length ? (records.reduce((s, r) => s + r.rating, 0) / records.length).toFixed(1) : '—'
  const excellent = records.filter(r => r.rating >= 4).length
  const poor = records.filter(r => r.rating <= 2).length

  const categoryAvg = CATEGORIES.map(cat => {
    const catRecords = records.filter(r => r.category === cat)
    const avg = catRecords.length ? catRecords.reduce((s, r) => s + r.rating, 0) / catRecords.length : 0
    return { cat, avg: avg.toFixed(1), count: catRecords.length }
  }).filter(c => c.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CSI Monitoring</h2>
          <p className="text-muted-foreground text-sm">Customer Satisfaction Index — track feedback and ratings</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />Record Feedback
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-2xl font-bold">{avgRating}</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">Average Rating</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : records.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Total Responses</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : excellent}</div>
          <div className="text-sm text-muted-foreground mt-1">Excellent (4–5 ★)</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-red-600">{loading ? '—' : poor}</div>
          <div className="text-sm text-muted-foreground mt-1">Poor (1–2 ★)</div>
        </CardContent></Card>
      </div>

      {/* Category breakdown */}
      {categoryAvg.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Ratings by Category</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categoryAvg.map(c => (
                <div key={c.cat} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{c.cat}</p>
                    <p className="text-xs text-muted-foreground">{c.count} response{c.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{c.avg}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Feedback Records</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No feedback recorded yet. Click <strong>Record Feedback</strong> to add the first entry.
                </TableCell></TableRow>
              ) : records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{r.client_name}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{r.category}</span>
                  </TableCell>
                  <TableCell><StarRating value={r.rating} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{r.feedback ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record feedback dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Customer Feedback</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Company or person name" value={form.client_name}
                onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v ?? p.category }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rating</Label>
              <StarRating value={form.rating} onChange={n => setForm(p => ({ ...p, rating: n }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Feedback / Comments</Label>
              <Textarea rows={3} placeholder="Any additional comments…" value={form.feedback}
                onChange={e => setForm(p => ({ ...p, feedback: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
