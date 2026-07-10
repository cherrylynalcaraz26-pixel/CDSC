'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Video, X, PlayCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// The "Video Demo" walkthrough shown on the Admin and Client dashboards.
const DEMO_VIDEO_URL = 'https://drive.google.com/file/d/1aGKS4Wk70ExguzxeB5HpL9OgPZdUpl4h/view?usp=sharing'
const DEMO_VIDEO_TITLE = 'CDSC Client Portal demo v3'

// Turns a pasted video link into something embeddable. Supports YouTube
// (watch/live/shorts/youtu.be), Vimeo, Facebook, Google Drive, direct video
// files, and falls back to embedding the URL as-is in an iframe.
function toEmbed(url: string): { kind: 'iframe' | 'video'; src: string } {
  const u = url.trim()
  const yt = u.match(/(?:youtube\.com\/(?:watch\?.*v=|live\/|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?autoplay=1` }
  const vimeo = u.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1` }
  const drive = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (drive) return { kind: 'iframe', src: `https://drive.google.com/file/d/${drive[1]}/preview` }
  if (/facebook\.com\/.+\/videos\/|fb\.watch\//.test(u)) {
    return { kind: 'iframe', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}&autoplay=true` }
  }
  if (/\.(mp4|webm|ogv|ogg|m3u8)(\?|#|$)/i.test(u)) return { kind: 'video', src: u }
  return { kind: 'iframe', src: u.startsWith('http') ? u : `https://${u}` }
}

function VideoModal({ title, url, live, onClose }: { title: string; url: string; live?: boolean; onClose: () => void }) {
  const embed = toEmbed(url)
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-2 text-white text-sm font-semibold">
            {live ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            ) : (
              <PlayCircle className="h-4 w-4 text-red-400" />
            )}
            {title}
          </span>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
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
  )
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

      {open && url && <VideoModal title="Live Video" url={url} live onClose={() => setOpen(false)} />}
    </>
  )
}

export function DemoVideoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors bg-white',
          className,
        )}>
        <PlayCircle className="h-4 w-4 text-red-600" /> Video Demo
      </button>

      {open && <VideoModal title={DEMO_VIDEO_TITLE} url={DEMO_VIDEO_URL} onClose={() => setOpen(false)} />}
    </>
  )
}
