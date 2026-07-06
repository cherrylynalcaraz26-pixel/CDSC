'use client'

import { useEffect, useMemo, useState } from 'react'
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
  clients: { company_name: string | null; contact_person: string | null } | null
}

interface Conversation {
  key: string
  company: string
  contact: string | null
  messages: ClientMessage[]
  lastMessage: ClientMessage
  unreadCount: number
}

function companyOf(msg: ClientMessage) {
  return msg.clients?.company_name || msg.client_name || 'Unknown Client'
}

function nameOf(msg: ClientMessage) {
  return msg.clients?.contact_person || null
}

export default function MessagesPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('client_messages')
      .select('*, clients(company_name, contact_person)')
      .order('sent_at', { ascending: false })
    setMessages((data ?? []) as ClientMessage[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function conversationKey(msg: ClientMessage): string {
    return msg.client_id ?? `name:${companyOf(msg)}`
  }

  const conversations = useMemo(() => {
    const map = new Map<string, ClientMessage[]>()
    for (const m of messages) {
      const key = conversationKey(m)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    const list: Conversation[] = Array.from(map.entries()).map(([key, msgs]) => {
      const sorted = [...msgs].sort((a, b) => (a.sent_at ?? '').localeCompare(b.sent_at ?? ''))
      const lastMessage = sorted[sorted.length - 1]
      return {
        key,
        company: companyOf(lastMessage),
        contact: nameOf(lastMessage),
        messages: sorted,
        lastMessage,
        unreadCount: sorted.filter(m => m.status === 'unread').length,
      }
    })
    return list.sort((a, b) => (b.lastMessage.sent_at ?? '').localeCompare(a.lastMessage.sent_at ?? ''))
  }, [messages])

  const selected = conversations.find(c => c.key === selectedKey) ?? null

  async function markConversationRead(conv: Conversation) {
    const unreadIds = conv.messages.filter(m => m.status === 'unread').map(m => m.id)
    if (unreadIds.length === 0) return
    await supabase.from('client_messages').update({ status: 'read' }).in('id', unreadIds)
    setMessages(ms => ms.map(m => unreadIds.includes(m.id) ? { ...m, status: 'read' } : m))
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) return
    const target = selected.lastMessage
    setReplying(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('client_messages')
      .update({ reply: replyText.trim(), replied_at: now, status: 'replied' })
      .eq('id', target.id)
    if (error) { toast.error(error.message); setReplying(false); return }
    setMessages(ms => ms.map(m => m.id === target.id ? { ...m, reply: replyText.trim(), replied_at: now, status: 'replied' } : m))
    setReplyText('')
    toast.success('Reply saved.')
    setReplying(false)
  }

  function openConversation(conv: Conversation) {
    setSelectedKey(conv.key)
    setReplyText('')
    markConversationRead(conv)
  }

  const unreadCount = messages.filter(m => m.status === 'unread').length

  const filteredConversations = conversations.filter(c => {
    if (filter === 'unread') return c.unreadCount > 0
    if (filter === 'replied') return !!c.lastMessage.reply
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
          { label: 'Conversations', value: conversations.length, icon: MessageSquare, color: 'text-blue-600' },
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
        {/* Conversation list */}
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
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No conversations</div>
            ) : filteredConversations.map(conv => (
              <button key={conv.key} onClick={() => openConversation(conv)}
                className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selectedKey === conv.key ? 'bg-muted' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1 ${conv.unreadCount > 0 ? 'bg-red-500' : 'bg-transparent'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{conv.company}</div>
                      {conv.contact && <div className="text-xs text-muted-foreground truncate">{conv.contact}</div>}
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage.message}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {conv.unreadCount > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                        {conv.unreadCount}
                      </span>
                    ) : statusBadge(conv.lastMessage.status)}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {conv.lastMessage.sent_at ? format(new Date(conv.lastMessage.sent_at), 'MMM d') : '—'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Conversation thread & reply */}
        <Card className="lg:col-span-2 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a conversation to view</p>
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
                      <div className="font-semibold text-sm">{selected.company}</div>
                      {selected.contact && <div className="text-xs text-muted-foreground">{selected.contact}</div>}
                    </div>
                  </div>
                  {statusBadge(selected.lastMessage.status)}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col gap-4 py-4">
                {/* Chat thread */}
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[420px] pr-1">
                  {selected.messages.map(m => (
                    <div key={m.id} className="space-y-2">
                      <div className="flex justify-start">
                        <div className="max-w-[80%] bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {m.sent_at ? format(new Date(m.sent_at), 'MMM d, yyyy · h:mm a') : '—'}
                          </p>
                        </div>
                      </div>
                      {m.reply && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-red-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
                            <p className="text-sm whitespace-pre-wrap">{m.reply}</p>
                            <p className="text-[10px] text-white/70 mt-1 flex items-center gap-1 justify-end">
                              <CheckCheck className="h-3 w-3" />
                              {m.replied_at ? format(new Date(m.replied_at), 'MMM d, yyyy · h:mm a') : ''}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Reply input */}
                <div className="mt-auto shrink-0">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {selected.lastMessage.reply ? 'Update Reply' : 'Write a Reply'}
                  </p>
                  <Textarea
                    rows={3}
                    placeholder="Type your reply here…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="resize-none"
                  />
                  <div className="flex justify-end mt-3">
                    <Button onClick={sendReply} disabled={!replyText.trim() || replying} className="gap-2">
                      <Send className="h-4 w-4" />
                      {replying ? 'Saving…' : selected.lastMessage.reply ? 'Update Reply' : 'Send Reply'}
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
