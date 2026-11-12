'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/** Fires once when the element scrolls into view. */
function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          obs.disconnect()
        }
      },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, inView }
}

/** Fade-up on scroll. Always fully visible when printing. */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.1)
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-700 ease-out motion-reduce:transition-none print:translate-y-0 print:opacity-100',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-7 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Counts up from 0 to `to` once visible. Renders the final value on the server. */
export function CountUp({ to, suffix = '', className }: { to: number; suffix?: string; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4)
  const [value, setValue] = useState(to)

  useEffect(() => {
    if (!inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const duration = 1600
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, to])

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  )
}

/** Horizontal bar that fills to `percent` once visible. */
export function ProgressBar({ percent, tone }: { percent: number; tone: 'in' | 'out' }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3)
  return (
    <div ref={ref} className="h-2 overflow-hidden rounded-full bg-white/5 print:bg-cdsc-line">
      <div
        className={cn(
          'h-full rounded-full transition-[width] delay-200 duration-1000 ease-out print:w-(--w)!',
          tone === 'in' ? 'bg-linear-to-r from-green-600 to-green-500' : 'bg-linear-to-r from-cdsc-accent-dark to-cdsc-accent',
        )}
        style={{ width: inView ? `${percent}%` : '0%', ['--w' as string]: `${percent}%` }}
      />
    </div>
  )
}
