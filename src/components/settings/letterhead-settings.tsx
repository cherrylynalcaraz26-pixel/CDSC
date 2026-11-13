'use client'

// Settings → Document Header. Save several headers (e.g. "Main", "Government
// bids", "Plain") and choose which one each document type prints with.
//
//   ┌ Your headers ───────┐ ┌ Edit: <name> ─────────────────┐ ┌ Preview ┐
//   │ • Main  (Default)   │ │ 1 Style  2 Logo  3 Details …   │ │         │
//   │ • Gov't bids        │ └────────────────────────────────┘ └─────────┘
//   └─────────────────────┘
//   ┌ Which header each document uses ─────────────────────────────────────┐

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/context/company-context'
import { uploadImageToDrive } from '@/lib/upload-image'
import { getErrorMessage } from '@/lib/error-message'
import {
  DEFAULT_LETTERHEAD, LETTERHEAD_DOCS, loadLetterheadSet, letterheadHtml, resolveLetterhead, newHeaderId,
  type LetterheadSet, type NamedLetterhead, type LetterheadLayout, type LetterheadDoc,
} from '@/lib/letterhead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2, Save, Upload, RotateCcw, Printer, ImageIcon, LayoutTemplate, X, Plus, Copy, Trash2, Star, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const LAYOUTS: { id: LetterheadLayout; label: string }[] = [
  { id: 'logo-left', label: 'Logo left' },
  { id: 'centered', label: 'Centered' },
  { id: 'logo-right', label: 'Logo right' },
]

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E8112D] text-[11px] font-bold text-white">{n}</span>{title}
      </p>
      {children}
    </section>
  )
}

export function LetterheadSettings() {
  const supabase = createClient()
  const { company } = useCompany()
  const [set, setSet] = useState<LetterheadSet | null>(null)
  const [saved, setSaved] = useState('')
  const [selId, setSelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'image' | 'logo' | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadLetterheadSet().then(v => { setSet(v); setSaved(JSON.stringify(v)); setSelId(v.default_id) })
  }, [])

  if (!set) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const lh = set.headers.find(h => h.id === selId) ?? set.headers[0]
  const dirty = JSON.stringify(set) !== saved
  const auto = resolveLetterhead({ ...lh, lines: '', company_name: '' }, company)

  const update = (patch: Partial<NamedLetterhead>) =>
    setSet(s => s && ({ ...s, headers: s.headers.map(h => (h.id === lh.id ? { ...h, ...patch } : h)) }))
  const usedBy = (id: string) => LETTERHEAD_DOCS.filter(d => (set.assign[d.id] ?? set.default_id) === id).map(d => d.label)

  function addHeader(copyOf?: NamedLetterhead) {
    const h: NamedLetterhead = copyOf
      ? { ...copyOf, id: newHeaderId(), name: `${copyOf.name} (copy)` }
      : { ...DEFAULT_LETTERHEAD, id: newHeaderId(), name: `Header ${set!.headers.length + 1}` }
    setSet(s => s && ({ ...s, headers: [...s.headers, h] }))
    setSelId(h.id)
  }
  function removeHeader(id: string) {
    if (set!.headers.length === 1) { toast.error('Keep at least one header'); return }
    setSet(s => {
      if (!s) return s
      const headers = s.headers.filter(h => h.id !== id)
      const default_id = s.default_id === id ? headers[0].id : s.default_id
      const assign = Object.fromEntries(Object.entries(s.assign).filter(([, v]) => v !== id))
      return { headers, default_id, assign }
    })
    setSelId(set!.default_id === id ? set!.headers.find(h => h.id !== id)!.id : set!.default_id)
  }
  const assign = (doc: LetterheadDoc, id: string) =>
    setSet(s => s && ({ ...s, assign: { ...s.assign, [doc]: id === s.default_id ? undefined : id } }))

  async function upload(file: File, kind: 'image' | 'logo') {
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    setUploading(kind)
    try {
      const url = await uploadImageToDrive(file, { displayName: kind === 'image' ? 'PDF Header Image' : 'PDF Header Logo', folder: 'Company' })
      update(kind === 'image' ? { image_url: url, mode: 'image' } : { logo_url: url })
      toast.success('Uploaded — click Save to use it')
    } catch (err) { toast.error(getErrorMessage(err, 'Upload failed')) }
    setUploading(null)
  }

  async function save() {
    const bad = set!.headers.find(h => h.mode === 'image' && !h.image_url)
    if (bad) { setSelId(bad.id); toast.error(`"${bad.name}" needs a header image, or switch it to Logo & details`); return }
    setSaving(true)
    const { error } = await supabase.from('system_settings').update({ pdf_header: set }).eq('id', 1)
    if (error) toast.error(/pdf_header/.test(error.message) ? 'Run database migration 043 first, then save again.' : getErrorMessage(error))
    else { setSaved(JSON.stringify(set)); toast.success('Document headers saved — new PDFs will use them') }
    setSaving(false)
  }

  function printSample() {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${lh.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:32px;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
      ${letterheadHtml(lh, company)}
      <div style="font-size:18px;font-weight:900;color:${lh.accent};letter-spacing:2px;text-align:center;margin:24px 0">SAMPLE DOCUMENT</div>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-5">
      {/* Save bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3">
        <p className="mr-auto text-sm text-muted-foreground">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</p>
        <Button variant="outline" className="h-9" disabled={!dirty} onClick={() => { const v = JSON.parse(saved) as LetterheadSet; setSet(v); setSelId(v.default_id) }}>
          <RotateCcw className="mr-1.5 h-4 w-4" />Undo changes
        </Button>
        <Button className="h-9 bg-[#E8112D] text-white hover:bg-[#D10F28]" disabled={saving || !dirty} onClick={save}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Save
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Header list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your headers</p>
          {set.headers.map(h => {
            const uses = usedBy(h.id)
            return (
              <button key={h.id} type="button" onClick={() => setSelId(h.id)}
                className={cn('w-full rounded-xl border px-3 py-2.5 text-left transition-colors', h.id === lh.id ? 'border-[#E8112D] bg-red-50 dark:bg-red-950/30' : 'hover:bg-muted')}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {h.mode === 'image' ? <ImageIcon className="h-3.5 w-3.5 shrink-0" /> : <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{h.name}</span>
                  {h.id === set.default_id && <span className="ml-auto rounded-full bg-[#E8112D] px-1.5 py-0.5 text-[10px] font-bold text-white">Default</span>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{uses.length ? `Used on ${uses.join(', ')}` : 'Not used yet'}</span>
              </button>
            )
          })}
          <Button variant="outline" className="h-9 w-full" onClick={() => addHeader()}><Plus className="mr-1.5 h-4 w-4" />New header</Button>
        </div>

        {/* Editor */}
        <div className="space-y-5 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1">
              <Label className="text-xs">Header name</Label>
              <Input value={lh.name} onChange={e => update({ name: e.target.value })} />
            </div>
            {lh.id !== set.default_id && (
              <Button variant="outline" className="h-9" onClick={() => setSet(s => s && ({ ...s, default_id: lh.id }))}><Star className="mr-1.5 h-4 w-4" />Make default</Button>
            )}
            <Button variant="outline" size="icon" className="h-9 w-9" title="Duplicate" onClick={() => addHeader(lh)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" className="h-9 w-9 text-red-600" title="Delete" onClick={() => removeHeader(lh.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>

          <Step n={1} title="Style">
            <div className="grid grid-cols-2 gap-2">
              {([['standard', 'Logo & company details', LayoutTemplate], ['image', 'Upload a header image', ImageIcon]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => update({ mode: id })}
                  className={cn('flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors', lh.mode === id ? 'border-[#E8112D] bg-red-50 text-[#E8112D] dark:bg-red-950/30' : 'hover:bg-muted')}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </button>
              ))}
            </div>
          </Step>

          {lh.mode === 'image' ? (
            <Step n={2} title="Header image">
              <p className="text-xs text-muted-foreground">Your letterhead banner — PNG or JPG, wide, under 3 MB. Prints full width at the top.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="h-9" onClick={() => imageRef.current?.click()} disabled={uploading === 'image'}>
                  {uploading === 'image' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}{lh.image_url ? 'Replace image' : 'Upload image'}
                </Button>
                {lh.image_url && <Button variant="ghost" className="h-9" onClick={() => update({ image_url: '' })}><X className="mr-1 h-4 w-4" />Remove</Button>}
              </div>
            </Step>
          ) : (
            <>
              <Step n={2} title="Layout & logo">
                <div className="flex flex-wrap gap-2">
                  {LAYOUTS.map(l => (
                    <button key={l.id} type="button" onClick={() => update({ layout: l.id })}
                      className={cn('rounded-lg border px-3 py-1.5 text-sm transition-colors', lh.layout === l.id ? 'border-[#E8112D] bg-red-50 font-semibold text-[#E8112D] dark:bg-red-950/30' : 'hover:bg-muted')}>
                      {l.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lh.show_logo} onChange={e => update({ show_logo: e.target.checked })} />Show logo</label>
                  {lh.show_logo && (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={lh.logo_url || company.logo_url || '/cdsc-logo.jpg'} alt="" className="h-full w-full object-contain p-1" />
                      </div>
                      <Button variant="outline" className="h-9" onClick={() => logoRef.current?.click()} disabled={uploading === 'logo'}>
                        {uploading === 'logo' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}Different logo
                      </Button>
                      {lh.logo_url && <Button variant="ghost" className="h-9" onClick={() => update({ logo_url: '' })}>Use company logo</Button>}
                    </>
                  )}
                </div>
              </Step>
              <Step n={3} title="Company details">
                <div className="space-y-1">
                  <Label className="text-xs">Company name</Label>
                  <Input value={lh.company_name} placeholder={auto.name} onChange={e => update({ company_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Detail lines (one per line)</Label>
                  <Textarea rows={4} value={lh.lines} placeholder={auto.lines.join('\n')} onChange={e => update({ lines: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Leave blank to use the address, phone, email and TIN from Company &amp; Business Profile.</p>
                </div>
                <div className="flex items-center gap-3">
                  <Label htmlFor="lh-accent" className="text-xs">Name colour</Label>
                  <input id="lh-accent" type="color" value={lh.accent} onChange={e => update({ accent: e.target.value })} className="h-8 w-12 cursor-pointer rounded border bg-transparent" />
                </div>
              </Step>
            </>
          )}

          <Step n={lh.mode === 'image' ? 3 : 4} title="Line under the header (optional)">
            <Input value={lh.footer} placeholder="e.g. VAT Reg. TIN 409-704-016-000 · PhilGEPS Registered" onChange={e => update({ footer: e.target.value })} />
          </Step>
          <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'image'); e.target.value = '' }} />
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'logo'); e.target.value = '' }} />
        </div>

        {/* Preview */}
        <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <Button variant="ghost" size="sm" onClick={printSample}><Printer className="mr-1.5 h-3.5 w-3.5" />Print sample</Button>
          </div>
          <div className="rounded-xl border bg-white p-6 text-[11px] text-gray-800 shadow-sm">
            <div dangerouslySetInnerHTML={{ __html: letterheadHtml(lh, company) }} />
            <div className="mt-4 text-center text-base font-black tracking-widest" style={{ color: lh.accent }}>PURCHASE ORDER</div>
            <div className="mt-4 space-y-1.5">{[0, 1, 2].map(i => <div key={i} className="h-2.5 rounded bg-gray-100" style={{ width: `${90 - i * 18}%` }} />)}</div>
          </div>
        </div>
      </div>

      {/* Assignment */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-semibold">Which header each document uses</p>
        <p className="mb-3 text-xs text-muted-foreground">Printouts and emailed PDFs. Anything not set uses the default header.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {LETTERHEAD_DOCS.map(d => {
            const id = set.assign[d.id] ?? set.default_id
            const h = set.headers.find(x => x.id === id)
            return (
              <div key={d.id} className="space-y-1">
                <Label className="text-xs">{d.label}</Label>
                <Select value={id} onValueChange={v => v && assign(d.id, v)}>
                  <SelectTrigger className="h-9"><span className="truncate">{h?.name}{id === set.default_id ? ' (default)' : ''}</span></SelectTrigger>
                  <SelectContent>
                    {set.headers.map(x => (
                      <SelectItem key={x.id} value={x.id}>
                        <span className="flex items-center gap-2">{x.name}{x.id === set.default_id && <Check className="h-3 w-3 text-muted-foreground" />}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
