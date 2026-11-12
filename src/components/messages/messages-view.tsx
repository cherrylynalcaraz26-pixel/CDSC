'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/error-message'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { MessageSquare, Send, CheckCheck, Search, Plus, Paperclip, X, FileText, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { uploadFileToDrive, isImageAttachment, driveImageSrc } from '@/lib/upload-image'

type PartyType = 'client' | 'supplier'

interface ClientInfo {
  company_name: string | null
  contact_person: string | null
  avatar_url: string | null
}

interface SupplierInfo {
  company_name: string | null
  contact_person: string | null
  logo_url: string | null
}

interface ClientMessage {
  id: string
  client_id: string | null
  client_name: string | null
  supplier_id: string | null
  supplier_name: string | null
  message: string
  sent_at: string
  status: string
  reply: string | null
  replied_at: string | null
  attachment_url: string | null
  attachment_name: string | null
  reply_attachment_url: string | null
  reply_attachment_name: string | null
  attachments?: Attachment[] | null
  reply_attachments?: Attachment[] | null
  clients: ClientInfo | null
  suppliers: SupplierInfo | null
}

interface Conversation {
  key: string
  partyType: PartyType
  company: string
  contact: string | null
  avatarUrl: string | null
  messages: ClientMessage[]
  lastMessage: ClientMessage
  unreadCount: number
}

interface PartyOption {
  id: string
  company_name: string
  contact_person: string | null
  avatar_url: string | null
}

function companyOf(msg: ClientMessage) {
  if (msg.supplier_id || msg.suppliers) return msg.suppliers?.company_name || msg.supplier_name || 'Unknown Supplier'
  return msg.clients?.company_name || msg.client_name || 'Unknown Client'
}

function nameOf(msg: ClientMessage) {
  if (msg.supplier_id || msg.suppliers) return msg.suppliers?.contact_person || null
  return msg.clients?.contact_person || null
}

function avatarOf(msg: ClientMessage) {
  if (msg.supplier_id || msg.suppliers) return msg.suppliers?.logo_url || null
  return msg.clients?.avatar_url || null
}

function partyTypeOf(msg: ClientMessage): PartyType {
  return (msg.supplier_id || msg.suppliers) ? 'supplier' : 'client'
}

const AVATAR_COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-600',
  'bg-teal-500', 'bg-blue-600', 'bg-violet-600', 'bg-pink-600',
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function Avatar({ name, seed, url, size = 'h-9 w-9 text-sm' }: { name: string; seed: string; url: string | null; size?: string }) {
  return (
    <div className={`${size} rounded-full overflow-hidden flex items-center justify-center text-white font-semibold shrink-0 ${url ? '' : avatarColor(seed)}`}>
      {url
        ? // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" />
        : initials(name)}
    </div>
  )
}

function AttachmentChip({ url, name, tone = 'muted' }: { url: string; name: string | null; tone?: 'muted' | 'onRed' }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border w-fit ${
        tone === 'onRed'
          ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
          : 'border-border bg-background hover:bg-muted'
      }`}
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate max-w-[180px]">{name || 'Attachment'}</span>
    </a>
  )
}

interface Attachment { url: string; name: string }

const EMOJIS = ['😀', '😊', '😂', '🙂', '😉', '😍', '🤝', '👍', '👌', '🙏', '👏', '🎉', '✅', '❌', '⚠️', '📦', '🚚', '🧾', '💰', '📅', '⏰', '📞', '📧', '📌', '🔧', '🛠️', '🔥', '💯', '❤️', '🙌', '🤔', '😅']

// Every file on one side of a message: the list column, or the legacy single file.
function filesOf(list: Attachment[] | null | undefined, url: string | null, name: string | null): Attachment[] {
  if (Array.isArray(list) && list.length) return list
  return url ? [{ url, name: name || 'Attachment' }] : []
}

function AttachmentGrid({ files, tone = 'muted' }: { files: Attachment[]; tone?: 'muted' | 'onRed' }) {
  if (!files.length) return null
  const images = files.filter(a => isImageAttachment(a.name))
  const others = files.filter(a => !isImageAttachment(a.name))
  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map(a => (
            <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={driveImageSrc(a.url)} alt={a.name} className="h-32 w-full max-w-[220px] object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {others.map(a => <AttachmentChip key={a.url} url={a.url} name={a.name} tone={tone} />)}
    </div>
  )
}

/** Small emoji palette that inserts at the caret of the given textarea. */
function EmojiButton({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} title="Emoji"
        className="flex items-center rounded-md border border-input px-2 py-1.5 text-base leading-none hover:bg-muted">🙂</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 grid w-64 grid-cols-8 gap-1 rounded-xl bg-popover p-2 shadow-xl shadow-black/15">
            {EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => { onPick(e); setOpen(false) }} className="rounded-md p-1 text-lg hover:bg-muted">{e}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FilePicker({ files, onChange, label = 'Attach' }: { files: File[]; onChange: (f: File[]) => void; label?: string }) {
  return (
    <>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ImagePlus className="h-3.5 w-3.5" /> {label}
        <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" className="hidden"
          onChange={e => { const picked = Array.from(e.target.files ?? []); if (picked.length) onChange([...files, ...picked].slice(0, 10)); e.target.value = '' }} />
      </label>
    </>
  )
}

function PendingFiles({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (!files.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f, i) => (
        <div key={i} className="relative">
          {f.type.startsWith('image/')
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={URL.createObjectURL(f)} alt={f.name} className="h-14 w-14 rounded-lg object-cover" />
            : <div className="flex h-14 max-w-[140px] items-center gap-1 rounded-lg bg-muted px-2 text-xs"><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.name}</span></div>}
          <button type="button" onClick={() => onRemove(i)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

async function uploadAll(files: File[]): Promise<Attachment[]> {
  return Promise.all(files.map(f => uploadFileToDrive(f, { folder: 'Messages' })))
}

// Attachment columns for a send. The list column is only written for 2+ files,
// so single-file sends keep working before migration 039 adds it.
function attachmentColumns(prefix: 'reply_' | '', list: Attachment[]) {
  return {
    [`${prefix}attachment_url`]: list[0]?.url ?? null,
    [`${prefix}attachment_name`]: list[0]?.name ?? null,
    ...(list.length > 1 ? { [`${prefix}attachments`]: list } : {}),
  }
}

export function MessagesView({ embedded = false }: { embedded?: boolean } = {}) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replying, setReplying] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'replied'>('all')
  const [search, setSearch] = useState('')

  // New conversation
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [newConvType, setNewConvType] = useState<PartyType>('client')
  const [clientOptions, setClientOptions] = useState<PartyOption[]>([])
  const [supplierOptions, setSupplierOptions] = useState<PartyOption[]>([])
  const [partyOptionsLoading, setPartyOptionsLoading] = useState(false)
  const [partyFilter, setPartyFilter] = useState('')
  const [pickedPartyId, setPickedPartyId] = useState<string | null>(null)
  const [newMessageText, setNewMessageText] = useState('')
  const [newConvFiles, setNewConvFiles] = useState<File[]>([])
  const [creatingConv, setCreatingConv] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('client_messages')
      .select('*, clients(company_name, contact_person, avatar_url), suppliers(company_name, contact_person, logo_url)')
      .order('sent_at', { ascending: false })
    setMessages((data ?? []) as ClientMessage[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function conversationKey(msg: ClientMessage): string {
    if (msg.client_id) return `client:${msg.client_id}`
    if (msg.supplier_id) return `supplier:${msg.supplier_id}`
    return `name:${companyOf(msg)}`
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
        partyType: partyTypeOf(lastMessage),
        company: companyOf(lastMessage),
        contact: nameOf(lastMessage),
        avatarUrl: avatarOf(lastMessage),
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
    if (!selected || (!replyText.trim() && replyFiles.length === 0)) return
    const target = selected.lastMessage
    setReplying(true)
    try {
      const files = await uploadAll(replyFiles)
      const now = new Date().toISOString()
      const reply = { reply: replyText.trim(), replied_at: now, status: 'replied', ...attachmentColumns('reply_', files) }
      if (!target.reply && !target.reply_attachment_url) {
        // Answer the client's latest message.
        const { error } = await supabase.from('client_messages').update(reply).eq('id', target.id)
        if (error) throw error
      } else {
        // Already answered — send a new message in the same thread instead of overwriting.
        const { error } = await supabase.from('client_messages').insert({
          client_id: target.client_id ?? null, client_name: target.client_name ?? null,
          supplier_id: target.supplier_id ?? null, supplier_name: target.supplier_name ?? null,
          message: '', sent_at: now, ...reply,
        })
        if (error) throw error
      }
      setReplyText('')
      setReplyFiles([])
      await load()
      toast.success('Message sent')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to send reply'))
    }
    setReplying(false)
  }

  function openConversation(conv: Conversation) {
    setSelectedKey(conv.key)
    setReplyText('')
    setReplyFiles([])
    markConversationRead(conv)
  }

  async function openNewConversation() {
    setNewConvType('client')
    setPickedPartyId(null)
    setPartyFilter('')
    setNewMessageText('')
    setNewConvFiles([])
    setNewConvOpen(true)
    setPartyOptionsLoading(true)
    const [{ data: clientData }, { data: supplierData }] = await Promise.all([
      clientOptions.length === 0
        ? supabase.from('clients').select('id, company_name, contact_person, avatar_url').order('company_name')
        : Promise.resolve({ data: null }),
      supplierOptions.length === 0
        ? supabase.from('suppliers').select('id, company_name, contact_person, logo_url').order('company_name')
        : Promise.resolve({ data: null }),
    ])
    if (clientData) setClientOptions(clientData as PartyOption[])
    if (supplierData) setSupplierOptions((supplierData as { id: string; company_name: string; contact_person: string | null; logo_url: string | null }[]).map(s => ({ id: s.id, company_name: s.company_name, contact_person: s.contact_person, avatar_url: s.logo_url })))
    setPartyOptionsLoading(false)
  }

  const currentPartyOptions = newConvType === 'client' ? clientOptions : supplierOptions
  const filteredPartyOptions = currentPartyOptions.filter(c =>
    !partyFilter.trim() || c.company_name.toLowerCase().includes(partyFilter.toLowerCase())
  )

  async function startNewConversation() {
    if (!pickedPartyId || (!newMessageText.trim() && newConvFiles.length === 0)) return
    const party = currentPartyOptions.find(c => c.id === pickedPartyId)
    if (!party) return
    setCreatingConv(true)
    try {
      const files = await uploadAll(newConvFiles)
      const now = new Date().toISOString()
      const { error } = await supabase.from('client_messages').insert({
        client_id: newConvType === 'client' ? party.id : null,
        client_name: newConvType === 'client' ? party.company_name : null,
        supplier_id: newConvType === 'supplier' ? party.id : null,
        supplier_name: newConvType === 'supplier' ? party.company_name : null,
        message: '',
        reply: newMessageText.trim(),
        ...attachmentColumns('reply_', files),
        replied_at: now,
        sent_at: now,
        status: 'replied',
      })
      if (error) throw error
      toast.success('Conversation started')
      setNewConvOpen(false)
      await load()
      setSelectedKey(`${newConvType}:${party.id}`)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to start conversation'))
    }
    setCreatingConv(false)
  }

  const unreadCount = messages.filter(m => m.status === 'unread').length
  const repliedCount = conversations.filter(c => !!c.lastMessage.reply).length

  const filteredConversations = conversations.filter(c => {
    if (filter === 'unread' && c.unreadCount === 0) return false
    if (filter === 'replied' && !c.lastMessage.reply) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hay = `${c.company} ${c.contact ?? ''} ${c.lastMessage.message} ${c.lastMessage.reply ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const statusBadge = (s: string) => {
    if (s === 'unread') return <Badge className="bg-red-100 text-red-700 text-[10px]">Unread</Badge>
    if (s === 'replied') return <Badge className="bg-green-100 text-green-700 text-[10px]">Replied</Badge>
    return <Badge className="bg-gray-100 text-gray-500 text-[10px]">Read</Badge>
  }

  const filterCounts: Record<'all' | 'unread' | 'replied', number> = {
    all: conversations.length,
    unread: conversations.filter(c => c.unreadCount > 0).length,
    replied: repliedCount,
  }

  return (
    <div className={`space-y-6 ${embedded ? 'relative min-h-full' : ''}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 ${embedded ? 'hidden' : ''}`}>
        <div className="h-9 w-9 rounded-lg bg-red-600/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-none">Messages</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Conversations with clients and suppliers</p>
        </div>
        {unreadCount > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold">{unreadCount} new</span>
        )}
      </div>

      {/* New conversation — round + button, lower right */}
      <button
        type="button"
        onClick={openNewConversation}
        title="New conversation"
        aria-label="New conversation"
        className={`${embedded ? 'fixed bottom-40 right-7 lg:bottom-28 lg:right-10' : 'fixed bottom-24 right-5 lg:bottom-8 lg:right-8'} z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#F84400] text-white shadow-lg shadow-orange-900/30 transition-transform hover:scale-105`}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Main panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Conversation list */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2 border-b space-y-3">
            <div className="flex items-center gap-2">
              {(['all', 'unread', 'replied'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors capitalize ${filter === f ? 'bg-red-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}>
                  {f}
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold ${filter === f ? 'bg-white/25 text-white' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                    {filterCounts[f]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search conversations…"
                className="pl-8 h-8 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={conv.company} seed={conv.key} url={conv.avatarUrl} size="h-8 w-8 text-xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-sm font-medium truncate">{conv.company}</div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 capitalize">{conv.partyType}</Badge>
                      </div>
                      {conv.contact && <div className="text-xs text-muted-foreground truncate">{conv.contact}</div>}
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage.message || conv.lastMessage.reply || (conv.lastMessage.attachment_name || conv.lastMessage.reply_attachment_name ? '📷 Photo / file' : '')}
                      </div>
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
                    <Avatar name={selected.company} seed={selected.key} url={selected.avatarUrl} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="font-semibold text-sm">{selected.company}</div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 capitalize">{selected.partyType}</Badge>
                      </div>
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
                      {(m.message.trim() || m.attachment_url) && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                            {m.message.trim() && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                            <AttachmentGrid files={filesOf(m.attachments, m.attachment_url, m.attachment_name)} />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {m.sent_at ? format(new Date(m.sent_at), 'MMM d, yyyy · h:mm a') : '—'}
                            </p>
                          </div>
                        </div>
                      )}
                      {(m.reply || m.reply_attachment_url) && (
                        <div className="flex justify-end">
                          <div className="max-w-[80%] bg-red-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5">
                            {m.reply && <p className="text-sm whitespace-pre-wrap">{m.reply}</p>}
                            <AttachmentGrid files={filesOf(m.reply_attachments, m.reply_attachment_url, m.reply_attachment_name)} tone="onRed" />
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
                  <Textarea
                    rows={3}
                    placeholder="Type a message…"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply() }}
                    className="resize-none"
                  />
                  <PendingFiles files={replyFiles} onRemove={i => setReplyFiles(fs => fs.filter((_, j) => j !== i))} />
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2">
                      <FilePicker files={replyFiles} onChange={setReplyFiles} label="Photos / files" />
                      <EmojiButton onPick={e => setReplyText(t => t + e)} />
                    </div>
                    <Button onClick={sendReply} disabled={(!replyText.trim() && replyFiles.length === 0) || replying} className="gap-2 bg-[#F84400] hover:bg-[#e03d00]">
                      <Send className="h-4 w-4" />
                      {replying ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* New conversation dialog */}
      <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
        <DialogContent size="landscape" className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              {(['client', 'supplier'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setNewConvType(t); setPickedPartyId(null); setPartyFilter('') }}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${newConvType === t ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium capitalize">{newConvType}</p>
              <Input
                placeholder={`Search ${newConvType}s…`}
                value={partyFilter}
                onChange={e => setPartyFilter(e.target.value)}
                className="h-9"
              />
              <div className="border rounded-lg max-h-52 overflow-y-auto divide-y">
                {partyOptionsLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading {newConvType}s…</div>
                ) : filteredPartyOptions.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No {newConvType}s found</div>
                ) : filteredPartyOptions.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setPickedPartyId(c.id)}
                    className={`w-full flex items-center gap-2.5 text-left px-3 py-2 hover:bg-muted/50 transition-colors ${pickedPartyId === c.id ? 'bg-muted' : ''}`}
                  >
                    <Avatar name={c.company_name} seed={c.id} url={c.avatar_url} size="h-7 w-7 text-[10px]" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.company_name}</div>
                      {c.contact_person && <div className="text-xs text-muted-foreground truncate">{c.contact_person}</div>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Message</p>
              <Textarea
                rows={4}
                placeholder="Type your message…"
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
                className="resize-none"
              />
              <PendingFiles files={newConvFiles} onRemove={i => setNewConvFiles(fs => fs.filter((_, j) => j !== i))} />
              <div className="flex items-center gap-2">
                <FilePicker files={newConvFiles} onChange={setNewConvFiles} label="Photos / files" />
                <EmojiButton onPick={e => setNewMessageText(t => t + e)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewConvOpen(false)}>Cancel</Button>
            <Button
              onClick={startNewConversation}
              disabled={!pickedPartyId || (!newMessageText.trim() && newConvFiles.length === 0) || creatingConv}
              className="bg-red-600 hover:bg-red-700"
            >
              {creatingConv ? 'Starting…' : 'Start Conversation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
