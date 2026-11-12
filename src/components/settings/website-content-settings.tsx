'use client'

// Settings → Website: edit the text of the public website. Saved as JSON in
// system_settings.website_content and merged over the built-in copy
// (src/lib/site-content.ts) — "Reset section" puts a section back to it.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/error-message'
import { DEFAULT_SITE_CONTENT, mergeSiteContent, type SiteContent } from '@/lib/site-content'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Plus, Trash2, Save, Loader2, RotateCcw, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

type Field = { key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'lines' | 'checkbox'; placeholder?: string }
type Row = Record<string, unknown>

// A repeatable list (cards, steps, categories…) with add / remove / reorder.
function ListEditor({ rows, fields, onChange, addLabel, blank }: {
  rows: Row[]; fields: Field[]; onChange: (rows: Row[]) => void; addLabel: string; blank: Row
}) {
  const update = (i: number, key: string, v: unknown) => onChange(rows.map((r, n) => (n === i ? { ...r, [key]: v } : r)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]; onChange(next)
  }
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => onChange(rows.filter((_, n) => n !== i))} title="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map(f => {
              const v = r[f.key]
              const wide = f.type === 'textarea' || f.type === 'lines'
              return (
                <div key={f.key} className={`space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
                  {f.type === 'checkbox' ? (
                    <label className="flex items-center gap-2 pt-5 text-xs"><input type="checkbox" checked={v !== false} onChange={e => update(i, f.key, e.target.checked)} />{f.label}</label>
                  ) : (
                    <>
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === 'textarea' ? (
                        <Textarea rows={2} value={String(v ?? '')} placeholder={f.placeholder} onChange={e => update(i, f.key, e.target.value)} />
                      ) : f.type === 'lines' ? (
                        <Textarea rows={3} value={Array.isArray(v) ? v.join('\n') : ''} placeholder="One per line" onChange={e => update(i, f.key, e.target.value.split('\n'))} />
                      ) : (
                        <Input type={f.type === 'number' ? 'number' : 'text'} value={String(v ?? '')} placeholder={f.placeholder}
                          onChange={e => update(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)} />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { ...blank }])}><Plus className="mr-1.5 h-3.5 w-3.5" />{addLabel}</Button>
    </div>
  )
}

function Section({ title, hint, page, onReset, children }: { title: string; hint: string; page: string; onReset: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border bg-card">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{hint} · shown on {page}</span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3">
          {children}
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" />Reset this section to the original text</button>
        </div>
      )}
    </div>
  )
}

const TITLED: Field[] = [{ key: 'title', label: 'Title' }, { key: 'description', label: 'Description', type: 'textarea' }]
const NAMED: Field[] = [{ key: 'name', label: 'Name' }, { key: 'description', label: 'Description', type: 'textarea' }]

export function WebsiteContentSettings() {
  const supabase = createClient()
  const [c, setC] = useState<SiteContent>(DEFAULT_SITE_CONTENT)
  const [video, setVideo] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('system_settings').select('website_content, live_video_url').single().then(({ data, error }) => {
      const merged = mergeSiteContent(error ? {} : (data as { website_content?: unknown })?.website_content)
      const v = (data as { live_video_url?: string } | null)?.live_video_url ?? ''
      setC(merged); setVideo(v); setSaved(JSON.stringify([merged, v])); setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => setC(s => ({ ...s, [k]: v }))
  const reset = <K extends keyof SiteContent>(k: K) => set(k, DEFAULT_SITE_CONTENT[k])
  const dirty = JSON.stringify([c, video]) !== saved

  async function save() {
    setSaving(true)
    const clean = mergeSiteContent(c) // drops empty rows / fills blanks from the defaults
    const { error } = await supabase.from('system_settings').update({ website_content: clean, live_video_url: video.trim() }).eq('id', 1)
    if (error) {
      toast.error(/website_content/.test(error.message) ? 'Run database migration 043 first, then save again.' : getErrorMessage(error))
    } else {
      setC(clean); setSaved(JSON.stringify([clean, video.trim()]))
      await fetch('/api/revalidate-site', { method: 'POST' }).catch(() => {})
      toast.success('Website updated — refresh the site to see it')
    }
    setSaving(false)
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  const lines3 = (arr: string[], onChange: (a: string[]) => void, labels: string[]) => (
    <div className="grid gap-2 sm:grid-cols-3">
      {labels.map((l, i) => (
        <div key={l} className="space-y-1">
          <Label className="text-xs">{l}</Label>
          <Input value={arr[i] ?? ''} onChange={e => { const n = [...arr]; n[i] = e.target.value; onChange(n) }} />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 px-4 py-3 backdrop-blur">
        <p className="mr-auto text-sm text-muted-foreground">{dirty ? 'You have unsaved changes.' : 'Open a section to edit its text.'}</p>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">View website <ExternalLink className="h-3.5 w-3.5" /></a>
        <Button onClick={save} disabled={saving || !dirty} className="bg-[#E8112D] text-white hover:bg-[#D10F28]">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}Save &amp; publish
        </Button>
      </div>

      <Section title="Contact details" hint="Phone, email, address and tagline" page="every page (header & footer)" onReset={() => reset('contact')}>
        <div className="grid gap-2 sm:grid-cols-2">
          {([['phone', 'Phone'], ['email', 'Email'], ['addressLine1', 'Address line 1'], ['addressLine2', 'Address line 2'], ['tagline', 'Tagline']] as const).map(([k, l]) => (
            <div key={k} className={`space-y-1 ${k === 'tagline' ? 'sm:col-span-2' : ''}`}>
              <Label className="text-xs">{l}</Label>
              <Input value={c.contact[k]} onChange={e => set('contact', { ...c.contact, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Home page — hero" hint="The big headline at the top" page="Home" onReset={() => reset('homeHero')}>
        <div className="space-y-1"><Label className="text-xs">Small label above the headline</Label><Input value={c.homeHero.badge} onChange={e => set('homeHero', { ...c.homeHero, badge: e.target.value })} /></div>
        {lines3(c.homeHero.headline, a => set('homeHero', { ...c.homeHero, headline: a }), ['Headline line 1', 'Line 2 (highlighted)', 'Line 3'])}
        <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={3} value={c.homeHero.description} onChange={e => set('homeHero', { ...c.homeHero, description: e.target.value })} /></div>
      </Section>

      <Section title="Headline numbers" hint="e.g. 500+ Products, 20+ Sectors" page="Home and About" onReset={() => reset('heroStats')}>
        <ListEditor rows={c.heroStats as unknown as Row[]} onChange={r => set('heroStats', r as unknown as SiteContent['heroStats'])} addLabel="Add number"
          blank={{ value: 0, suffix: '+', label: '', animate: true }}
          fields={[{ key: 'value', label: 'Number', type: 'number' }, { key: 'suffix', label: 'After the number', placeholder: '+ or %' }, { key: 'label', label: 'Label' }, { key: 'animate', label: 'Count up when shown', type: 'checkbox' }]} />
      </Section>

      <Section title="Product categories" hint="What We Supply cards" page="Home, Products and footer" onReset={() => reset('productCategories')}>
        <ListEditor rows={c.productCategories as unknown as Row[]} onChange={r => set('productCategories', r as unknown as SiteContent['productCategories'])} addLabel="Add category"
          blank={{ name: '', description: '', items: [] }}
          fields={[...NAMED, { key: 'items', label: 'Items', type: 'lines' }]} />
      </Section>

      <Section title="Why choose CDSC" hint="Reasons to buy from CDSC" page="Home" onReset={() => reset('whyCds')}>
        <ListEditor rows={c.whyCds as unknown as Row[]} onChange={r => set('whyCds', r as unknown as SiteContent['whyCds'])} addLabel="Add reason" blank={{ title: '', description: '' }} fields={TITLED} />
      </Section>

      <Section title="Ordering process" hint="Steps from requirement to delivery" page="Home and Request a Quote" onReset={() => reset('procurementProcess')}>
        <ListEditor rows={c.procurementProcess as unknown as Row[]} onChange={r => set('procurementProcess', r as unknown as SiteContent['procurementProcess'])} addLabel="Add step" blank={{ step: '', title: '', description: '' }} fields={TITLED} />
      </Section>

      <Section title="Industries" hint="Industries CDSC serves" page="Home and Industries" onReset={() => reset('industries')}>
        <ListEditor rows={c.industries as unknown as Row[]} onChange={r => set('industries', r as unknown as SiteContent['industries'])} addLabel="Add industry" blank={{ name: '', description: '' }} fields={NAMED} />
      </Section>

      <Section title="Services" hint="What CDSC offers" page="Services" onReset={() => reset('services')}>
        <ListEditor rows={c.services as unknown as Row[]} onChange={r => set('services', r as unknown as SiteContent['services'])} addLabel="Add service" blank={{ title: '', description: '' }} fields={TITLED} />
      </Section>

      <Section title="About page — hero" hint="Headline at the top of About Us" page="About" onReset={() => reset('profileHero')}>
        <div className="space-y-1"><Label className="text-xs">Small label</Label><Input value={c.profileHero.badge} onChange={e => set('profileHero', { ...c.profileHero, badge: e.target.value })} /></div>
        {lines3(c.profileHero.headline, a => set('profileHero', { ...c.profileHero, headline: a }), ['Headline part 1', 'Part 2 (highlighted)', 'Part 3'])}
        <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={3} value={c.profileHero.description} onChange={e => set('profileHero', { ...c.profileHero, description: e.target.value })} /></div>
      </Section>

      <Section title="Our story" hint="Company overview paragraphs" page="About" onReset={() => reset('companyOverview')}>
        {c.companyOverview.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <Textarea rows={3} value={p} onChange={e => set('companyOverview', c.companyOverview.map((x, n) => (n === i ? e.target.value : x)))} />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-red-600" onClick={() => set('companyOverview', c.companyOverview.filter((_, n) => n !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => set('companyOverview', [...c.companyOverview, ''])}><Plus className="mr-1.5 h-3.5 w-3.5" />Add paragraph</Button>
      </Section>

      <Section title="Mission & vision" hint="Mission and vision statements" page="About" onReset={() => { reset('mission'); reset('vision') }}>
        <div className="space-y-1"><Label className="text-xs">Mission</Label><Textarea rows={3} value={c.mission} onChange={e => set('mission', e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Vision</Label><Textarea rows={3} value={c.vision} onChange={e => set('vision', e.target.value)} /></div>
      </Section>

      <Section title="Core values" hint="Values listed under mission & vision" page="About" onReset={() => reset('coreValues')}>
        <ListEditor rows={c.coreValues as unknown as Row[]} onChange={r => set('coreValues', r as unknown as SiteContent['coreValues'])} addLabel="Add value" blank={{ title: '', description: '' }} fields={TITLED} />
      </Section>

      <Card><CardContent className="space-y-1.5 pt-5">
        <Label>Demo video URL</Label>
        <Input placeholder="e.g. https://www.youtube.com/watch?v=… or a Google Drive link" value={video} onChange={e => setVideo(e.target.value)} />
        <p className="text-xs text-muted-foreground">
          Shown in the &quot;See How Ordering Works&quot; section of the website and by the Demo Video button on the client portal.
          Leave blank for the default demo. Supports YouTube, Vimeo, Facebook, Google Drive or a direct video link.
        </p>
      </CardContent></Card>
    </div>
  )
}
