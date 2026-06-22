'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, ChevronLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'

interface Item {
  description: string
  quantity: string
  unit: string
  remarks: string
}

function blankItem(): Item {
  return { description: '', quantity: '1', unit: 'pcs', remarks: '' }
}

const UNITS = ['pcs', 'sets', 'boxes', 'rolls', 'liters', 'kg', 'meters', 'bags', 'pairs', 'units']

export default function NewRequestPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<Item[]>([blankItem()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/portal/login'); return }
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('auth_user_id', session.user.id)
        .single()
      if (clientRow) {
        setClientId(clientRow.id)
        setClientName(clientRow.company_name)
      }
    }
    init()
  }, [])

  function setItem(i: number, k: keyof Item, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) { toast.error('Subject is required'); return }
    if (!clientId) { toast.error('Client account not linked'); return }
    const filledItems = items.filter(it => it.description.trim())
    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const soNumber = `SO-P-${Date.now().toString().slice(-8)}`

      const { data: soData, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          so_number: soNumber,
          so_date: today,
          client_id: clientId,
          client_name: clientName,
          client_po_number: subject.trim(),
          remarks: message.trim() || null,
          status: 'draft',
          total_amount: 0,
        })
        .select('id')
        .single()

      if (soErr) throw soErr

      if (soData?.id && filledItems.length > 0) {
        const itemRows = filledItems.map(it => ({
          so_id: soData.id,
          item_name: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit,
          unit_price: 0,
          total_amount: 0,
        }))
        const { error: itemErr } = await supabase.from('so_items').insert(itemRows)
        if (itemErr) toast.error(`Items: ${itemErr.message}`)
      }

      toast.success('Purchase request submitted as Sales Order!')
      router.push('/portal/requests')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit request')
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/portal/requests" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to My Orders
        </Link>
        <h1 className="text-2xl font-bold">New Purchase Request</h1>
        <p className="text-muted-foreground text-sm mt-1">Submit a request for products or services to CDSC Industrial Supply.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Subject / Purchase Reference <span className="text-red-500">*</span></Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Industrial Supplies for Project XYZ"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Additional Notes</Label>
              <Textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Delivery requirements, project details, special instructions, etc."
              />
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Items Requested</h2>
              <p className="text-xs text-muted-foreground">List the specific items you require</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems(p => [...p, blankItem()])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <Card key={i}>
                <CardContent className="pt-4 pb-3">
                  <div className="grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-5 space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={item.description}
                        onChange={e => setItem(i, 'description', e.target.value)}
                        placeholder="Item name or description"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => setItem(i, 'quantity', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Unit</Label>
                      <Select value={item.unit} onValueChange={(v: string | null) => setItem(i, 'unit', v ?? 'pcs')}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Remarks</Label>
                      <Input
                        value={item.remarks}
                        onChange={e => setItem(i, 'remarks', e.target.value)}
                        placeholder="optional"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-1 flex items-end pb-0.5 justify-end">
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => router.push('/portal/requests')}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Submit Request
          </Button>
        </div>
      </form>
    </div>
  )
}
