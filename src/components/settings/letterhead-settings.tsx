'use client'

// Settings → Document Header: the logo and company details (or an uploaded
// header image) printed at the top of every PO, Quotation and Sales Order.

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCompany } from '@/context/company-context'
import { uploadImageToDrive } from '@/lib/upload-image'
import { getErrorMessage } from '@/lib/error-message'
import {
  DEFAULT_LETTERHEAD, loadLetterhead, letterheadHtml, resolveLetterhead,
  type Letterhead, type LetterheadLayout,
} from '@/lib/letterhead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Save, Upload, RotateCcw, Printer, ImageIcon, LayoutTemplate, X } from 'lucide-react'
import { toast } from 'sonner'

const LAYOUTS: { id: LetterheadLayout; label: string }[] = [
  { id: 'logo-left', label: 'Logo left' },
  { id: 'centered', label: 'Centered' },
  { id: 'logo-right', label: 'Logo right' },
]

export function LetterheadSettings() {
  const supabase = createClient()
  const { company } = useCompany()
  const [lh, setLh] = useState<Letterhead>(DEFAULT_LETTERHEAD)
  const [saved, setSaved] = useState<Letterhead>(DEFAULT_LETTERHEAD)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'image' | 'logo' | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadLetterhead().then(v => { setLh(v); setSaved(v); setLoading(false) })
  }, [])

  const set = <K extends keyof Letterhead>(k: K, v: Letterhead[K]) => setLh(s => ({ ...s, [k]: v }))
  const dirty = JSON.stringify(lh) !== JSON.stringify(saved)
  const auto = resolveLetterhead({ ...lh, lines: '', company_name: '' }, company)

  async function upload(file: File, kind: 'image' | 'logo') {
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB'); return }
    setUploading(kind)
    try {
      const url = await uploadImageToDrive(file, { displayName: kind === 'image' ? 'PDF Header Image' : 'PDF Header Logo', folder: 'Company' })
      if (kind === 'image') setLh(s => ({ ...s, image_url: url, mode: 'image' }))
      else set('logo_url', url)
      toast.success('Uploaded — click Save to use it on documents')
    } catch (err) { toast.error(getErrorMessage(err, 'Upload failed')) }
    setUploading(null)
  }

  async function save() {
    if (lh.mode === 'image' && !lh.image_url) { toast.error('Upload a header image first, or switch to Logo & details'); return }
    setSaving(true)
    const { error } = await supabase.from('system_settings').update({ pdf_header: lh }).eq('id', 1)
    if (error) toast.error(/pdf_header/.test(error.message) ? 'Run database migration 043 first, then save again.' : getErrorMessage(error))
    else { setSaved(lh); toast.success('Document header saved — new PDFs will use it') }
    setSaving(false)
  }

  function printSample() {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Header preview</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:32px;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>
      ${letterheadHtml(lh, company)}
      <div style="font-size:18px;font-weight:900;color:${lh.accent};letter-spacing:2px;text-align:center;margin:24px 0">SAMPLE DOCUMENT</div>
      <div style="color:#9ca3af;text-align:center">This is how the top of every Purchase Order, Quotation and Sales Order will look.</div>
    </body></html>`)
    win.document.close()
  }

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card><CardContent className="space-y-5 pt-5">
        <div className="space-y-2">
          <Label>Header style</Label>
          <div className="grid grid-cols-2 gap-2">
            {([['standard', 'Logo & company details', LayoutTemplate], ['image', 'Upload a header image', ImageIcon]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" onClick={() => set('mode', id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${lh.mode === id ? 'border-[#E8112D] bg-red-50 text-[#E8112D] dark:bg-red-950/30' : 'hover:bg-muted'}`}>
                <Icon className="h-4 w-4 shrink-0" />{label}
              </button>
            ))}
          </div>
        </div>

        {lh.mode === 'image' ? (
          <div className="space-y-2">
            <Label>Header image</Label>
            <p className="text-xs text-muted-foreground">Your existing letterhead banner (PNG or JPG, wide format, under 3 MB). It prints full width at the top of each document.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => imageRef.current?.click()} disabled={uploading === 'image'}>
                {uploading === 'image' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                {lh.image_url ? 'Replace image' : 'Upload image'}
              </Button>
              {lh.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => set('image_url', '')}><X className="mr-1 h-3.5 w-3.5" />Remove</Button>}
            </div>
            <input ref={imageRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'image'); e.target.value = '' }} />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Layout</Label>
              <div className="flex flex-wrap gap-2">
                {LAYOUTS.map(l => (
                  <button key={l.id} type="button" onClick={() => set('layout', l.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${lh.layout === l.id ? 'border-[#E8112D] bg-red-50 font-semibold text-[#E8112D] dark:bg-red-950/30' : 'hover:bg-muted'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Logo</Label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={lh.show_logo} onChange={e => set('show_logo', e.target.checked)} /> Show logo
                </label>
              </div>
              {lh.show_logo && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lh.logo_url || company.logo_url || '/cdsc-logo.jpg'} alt="" className="h-full w-full object-contain p-1" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploading === 'logo'}>
                    {uploading === 'logo' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}Use a different logo
                  </Button>
                  {lh.logo_url && <Button type="button" variant="ghost" size="sm" onClick={() => set('logo_url', '')}>Use company logo</Button>}
                  <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, 'logo'); e.target.value = '' }} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Company name</Label>
              <Input value={lh.company_name} placeholder={auto.name} onChange={e => set('company_name', e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Details (one per line)</Label>
              <Textarea rows={4} value={lh.lines} placeholder={auto.lines.join('\n')} onChange={e => set('lines', e.target.value)} />
              <p className="text-xs text-muted-foreground">Leave blank to use the address, phone, email and TIN from Company &amp; Business Profile.</p>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="lh-accent">Name colour</Label>
              <input id="lh-accent" type="color" value={lh.accent} onChange={e => set('accent', e.target.value)} className="h-8 w-12 cursor-pointer rounded border bg-transparent" />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label>Line under the header (optional)</Label>
          <Input value={lh.footer} placeholder="e.g. VAT Reg. TIN 409-704-016-000 · PhilGEPS Registered" onChange={e => set('footer', e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button onClick={save} disabled={saving || !dirty} className="bg-[#E8112D] text-white hover:bg-[#D10F28]">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}Save
          </Button>
          <Button variant="outline" onClick={() => setLh(saved)} disabled={!dirty}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Undo changes</Button>
          <Button variant="outline" onClick={() => setLh(DEFAULT_LETTERHEAD)}>Reset to default</Button>
          <Button variant="ghost" onClick={printSample} className="ml-auto"><Printer className="mr-1.5 h-3.5 w-3.5" />Print a sample</Button>
        </div>
      </CardContent></Card>

      <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
        <div className="rounded-xl border bg-white p-6 text-[11px] text-gray-800 shadow-sm">
          <div dangerouslySetInnerHTML={{ __html: letterheadHtml(lh, company) }} />
          <div className="mt-4 text-center text-base font-black tracking-widest" style={{ color: lh.accent }}>PURCHASE ORDER</div>
          <div className="mt-4 space-y-1.5">
            {[0, 1, 2].map(i => <div key={i} className="h-2.5 rounded bg-gray-100" style={{ width: `${90 - i * 18}%` }} />)}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Used on Purchase Orders, Quotations and Sales Orders — printouts and emailed PDFs.</p>
      </div>
    </div>
  )
}
