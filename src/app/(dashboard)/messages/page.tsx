'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Send, CheckCheck, Clock, User } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ClientMessage {
  id: string
  client_id: string | null
  client_name: string | null
  message: string
  sent_at: string
  status: string
  reply: string | null
  replied_at: string | null
}

export default function MessagesPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ClientMessage | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('client_messages')
      .select('*')
      .order('sent_at', { ascending: false })
    setMessages(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markRead(id: string) {
    await supabase.from('client_messages').update({ status: 'read' }).eq('id', id)
    setMessages(ms => ms.map(m => m.id === id ? { ...m, status: 'read' } : m))
    if (selected?.id === id) setSelected(s => s ? { ...s, status: 'read' } : s)
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return
    setReplying(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('client_messages')
      .update({ reply: replyText.trim(), replied_at: now, status: 'replied' })
      .eq('id', selected.id)
    if (error) { toast.error(error.message); setReplying(false); return }
    const updated = { ...selected, reply: replyText.trim(), replied_at: now, status: 'replied' }
    setMessages(ms => ms.map(m => m.id === selected.id ? updated : m))
    setSelected(updated)
    setReplyText('')
    toast.success('Reply saved.')
    setReplying(false)
  }

  function openMessage(msg: ClientMessage) {
    setSelected(msg)
    setReplyText(msg.reply ?? '')
    if (msg.status === 'unread') markRead(msg.id)
  }

  const unreadCount = messages.filter(m => m.status === 'unread').length

  const filtered = messages.filter(m => {
    if (filter === 'unread') return m.status === 'unread'
    if (filter === 'replied') return m.status === 'replied'
    return true
  })

  const statusBadge = (s: string) => {
    if (s === 'unread') return <Badge className="bg-red-100 text-red-700 text-[10px]">Unread</Badge>
    if (s === 'replied') return <Badge className="bg-green-100 text-green-700 text-[10px]">Replied</Badge>
    return <Badge className="bg-gray-100 text-gray-500 text-[10px]">Read</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-red-600/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-none">Client Messages</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Messages sent from the client portal</p>
        </div>
        {unreadCount > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">{unreadCount} new</span>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Messages', value: messages.length, icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Unread', value: unreadCount, icon: Clock, color: 'text-red-600' },
          { label: 'Replied', value: messages.filter(m => m.status === 'replied').length, icon: CheckCheck, color: 'text-green-600' },
        ].map(c => (
          <Card key={c.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? '—' : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Message list */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-2">
              {(['all', 'unread', 'replied'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${filter === f ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                  {f}
                </button>
              ))}
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto divide-y">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No messages</div>
            ) : filtered.map(msg => (
              <button key={msg.id} onClick={() => openMessage(msg)}
                className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selected?.id === msg.id ? 'bg-muted' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1 ${msg.status === 'unread' ? 'bg-red-500' : 'bg-transparent'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{msg.client_name ?? 'Unknown Client'}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{msg.message}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {statusBadge(msg.status)}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {msg.sent_at ? format(new Date(msg.sent_at), 'MMM d') : '—'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Message detail & reply */}
        <Card className="lg:col-span-2 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a message to view</p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-red-600/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{selected.client_name ?? 'Unknown Client'}</div>
                      <div className="text-xs text-muted-foreground">
                        {selected.sent_at ? format(new Date(selected.sent_at), 'MMM d, yyyy · h:mm a') : '—'}
                      </div>
                    </div>
                  </div>
                  {statusBadge(selected.status)}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-4 py-4">
                {/* Client message */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Message</p>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">{selected.message}</div>
                </div>

                {/* Existing reply */}
                {selected.reply && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide flex items-center gap-1">
                      <CheckCheck className="h-3 w-3" /> Reply sent {selected.replied_at ? format(new Date(selected.replied_at), 'MMM d, yyyy') : ''}
                    </p>
                    <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm whitespace-pre-wrap">{selected.reply}</div>
                  </div>
                )}

                {/* Reply input */}
                <div className="mt-auto">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {selected.reply ? 'Update Reply' : 'Write a Reply'}
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="Type your reply here…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <Button onClick={sendReply} disabled={!replyText.trim() || replying} className="gap-2">
                      <Send className="h-4 w-4" />
                      {replying ? 'Saving…' : selected.reply ? 'Update Reply' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
