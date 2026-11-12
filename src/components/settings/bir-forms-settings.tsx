'use client'

// BIR Forms — reference images for each BIR return, shown beside the official
// form in BIR Compliance (modelled on the CHEM app's Settings → BIR Forms).
// The form list comes from the same deadline engine as BIR Compliance, so the
// two can never drift apart again.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, ImagePlus, X, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-message'
import { uploadImageToDrive, driveImageSrc } from '@/lib/upload-image'
import { allBirForms, defaultApplicableForms, type TaxProfile } from '@/lib/bir/compliance-calendar'
import { deleteWithUndo } from '@/lib/delete-with-undo'

// Turns a Google Drive share link into a direct image link the browser can render.
function normalizeUrl(raw: string): string {
  const url = raw.trim()
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/)
  return m ? `https://drive.google.com/uc?export=view&id=${m[1]}` : url
}

export function BirFormsSettings() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [profile, setProfile] = useState<TaxProfile>({ vatRegistered: true, isCorporate: false, withholdingAgent: false, hasEmployees: false })
  const [applicable, setApplicable] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [linkFor, setLinkFor] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('bir_form_templates').select('form_code, image_url'),
      supabase.from('system_settings').select('*').single(),
    ]).then(([{ data }, { data: sys }]) => {
      if (!active) return
      setTemplates(Object.fromEntries((data ?? []).map((r: { form_code: string; image_url: string }) => [r.form_code, r.image_url])))
      if (sys) {
        setProfile({
          vatRegistered: !!sys.vat_registered,
          isCorporate: String(sys.business_type ?? '').toLowerCase().includes('corp'),
          withholdingAgent: sys.is_top_withholding_agent === true,
          hasEmployees: sys.has_employees === true,
        })
        setApplicable(Array.isArray(sys.bir_applicable_forms) ? sys.bir_applicable_forms : null)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const forms = useMemo(() => {
    const appl = applicable ?? defaultApplicableForms(profile)
    // Books / Inventory / eAFS have no BIR form image.
    return allBirForms(profile)
      .filter(f => !['Books', 'Inventory', 'eAFS'].includes(f.form))
      .map(f => ({ ...f, applies: appl.includes(f.form) }))
      .filter(f => showAll || f.applies)
  }, [profile, applicable, showAll])

  async function save(code: string, url: string) {
    const { error } = await supabase.from('bir_form_templates').upsert({ form_code: code, image_url: url, updated_at: new Date().toISOString() })
    if (error) throw error
    setTemplates(prev => ({ ...prev, [code]: url }))
  }

  async function upload(code: string, file: File) {
    setBusy(code)
    try { await save(code, await uploadImageToDrive(file, { displayName: `BIR Form ${code}`, folder: 'BIR Forms' })); toast.success(`${code} form image saved`) }
    catch (err) { toast.error(getErrorMessage(err, 'Upload failed')) }
    setBusy(null)
  }

  async function saveLink() {
    if (!linkFor || !link.trim()) return
    setBusy(linkFor)
    try { await save(linkFor, normalizeUrl(link)); toast.success(`${linkFor} form image saved`); setLinkFor(null); setLink('') }
    catch (err) { toast.error(getErrorMessage(err, 'Could not save the link')) }
    setBusy(null)
  }

  async function remove(code: string) {
    const url = templates[code]
    let gone = false
    await deleteWithUndo(supabase, {
      table: 'bir_form_templates', key: 'form_code', id: code, label: `${code} form image`,
      onChange: () => {
        gone = !gone
        setTemplates(prev => { const n = { ...prev }; if (gone) delete n[code]; else n[code] = url; return n })
      },
    })
  }

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Upload the blank or scanned BIR form for each return CDSC files, or paste a public image / Google Drive link.
          It&apos;s shown beside the computed figures when you generate a form in BIR Compliance.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#F84400]" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Show forms that don&apos;t apply to CDSC
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {forms.map(f => (
          <div key={f.form} className={`space-y-2 rounded-xl bg-card p-3 shadow-md shadow-black/5 ${f.applies ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-sm font-semibold text-[#F84400]">{f.form}</div>
                <div className="text-xs text-muted-foreground">{f.title}</div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{f.applies ? f.frequency : 'N/A'}</span>
            </div>
            {templates[f.form] ? (
              <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={driveImageSrc(templates[f.form])} alt={`${f.form} form`} className="max-h-full max-w-full object-contain" />
                <button type="button" onClick={() => remove(f.form)} title="Remove image"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg bg-muted/40 text-xs text-muted-foreground hover:bg-muted">
                {busy === f.form ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                {busy === f.form ? 'Saving…' : 'Upload form image'}
                <input type="file" accept="image/*" className="hidden" disabled={busy !== null}
                  onChange={e => { const file = e.target.files?.[0]; if (file) upload(f.form, file); e.target.value = '' }} />
              </label>
            )}
            {linkFor === f.form ? (
              <div className="flex gap-1">
                <Input className="h-8 text-xs" placeholder="https://drive.google.com/…" value={link} onChange={e => setLink(e.target.value)} />
                <Button size="sm" className="h-8 bg-[#F84400] hover:bg-[#e03d00]" onClick={saveLink} disabled={busy !== null}>Save</Button>
              </div>
            ) : (
              <button type="button" onClick={() => { setLinkFor(f.form); setLink('') }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Link2 className="h-3 w-3" />Use a link instead
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
