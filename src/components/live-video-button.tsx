'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Video, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Turns a pasted video link into something embeddable. Supports YouTube
// (watch/live/shorts/youtu.be), Vimeo, Facebook, direct video files, and
// falls back to embedding the URL as-is in an iframe.
function toEmbed(url: string): { kind: 'iframe' | 'video'; src: string } {
  const u = url.trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?.*v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` }
  const vimeo = u.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` }
  if (/facebook\.com\/.+\/videos\/|fb\.watch\//.test(u)) {
    return { kind: 'iframe', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&autoplay=true` }
  }
  if (/\.(mp4|webm|ogv|ogg|m3u8)(\?|#|$)/i.test(u)) return { kind: 'video', src: u }
  return { kind: 'iframe', src: u.startsWith('http') ? u : `https://${u}` }
}

export function LiveVideoButton({ hideWhenUnset = false, className }: { hideWhenUnset?: boolean; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('system_settings').select('live_video_url').single().then(({ data }) => {
      const v = (data?.live_video_url ?? '').trim()
      setUrl(v || null)
    })
  }, [])

  if (hideWhenUnset && !url) return null

  function handleClick() {
    if (!url) {
      toast.info('No live video configured yet. Add a Live Video URL in Company Profile settings.')
      return
    }
    setOpen(true)
  }

  const embed = url ? toEmbed(url) : null

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors',
          className,
        )}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
        <Video className="h-4 w-4" /> Live Video
      </button>

      {open && embed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-white text-sm font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                Live Video
              </span>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl" style={{ paddingTop: '56.25%' }}>
              {embed.kind === 'video' ? (
                <video src={embed.src} controls autoPlay className="absolute inset-0 w-full h-full" />
              ) : (
                <iframe
                  src={embed.src}
                  className="absolute inset-0 w-full h-full border-0"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
