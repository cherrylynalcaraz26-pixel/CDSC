"use client"

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

/** "1234567.5" → "1,234,567.5" (keeps a trailing "." or "-" while the user types). */
export function formatWithCommas(raw: string): string {
  if (raw === "" || raw === "-") return raw
  const negative = raw.startsWith("-")
  const body = negative ? raw.slice(1) : raw
  const [int, dec] = body.split(".")
  const intFmt = (int || (dec !== undefined ? "0" : "")).replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return (negative ? "-" : "") + intFmt + (dec !== undefined ? "." + dec : "")
}

const countSignificant = (s: string) => s.replace(/,/g, "").length

/**
 * Number field that shows thousands separators while typing (1,250,000.00) but
 * still hands the plain number string ("1250000.00") to onChange — so every
 * existing `parseFloat(e.target.value)` handler keeps working unchanged.
 */
function NumberInput({
  className, value, defaultValue, onChange, min, ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const ref = React.useRef<HTMLInputElement>(null)
  const caret = React.useRef<number | null>(null)
  const controlled = value !== undefined
  const [inner, setInner] = React.useState(() => (defaultValue ?? "").toString())
  const raw = (controlled ? value ?? "" : inner).toString()
  const allowNegative = !(typeof min === "number" ? min >= 0 : typeof min === "string" ? Number(min) >= 0 : false)

  // Restore the caret after commas are inserted/removed, counting only real characters.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current === null || document.activeElement !== el) return
    let seen = 0, pos = 0
    while (pos < el.value.length && seen < caret.current) {
      if (el.value[pos] !== ",") seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
    caret.current = null
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const typed = e.target.value
    const cleaned = typed.replace(/,/g, "")
    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/
    if (!pattern.test(cleaned)) return // ignore letters etc.
    caret.current = countSignificant(typed.slice(0, e.target.selectionStart ?? typed.length))
    if (!controlled) setInner(cleaned)
    if (onChange) {
      // Hand handlers the comma-free value via a target that shadows `.value`.
      const target = Object.create(e.target, { value: { value: cleaned } }) as HTMLInputElement
      onChange({ ...e, target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>)
    }
  }

  return (
    <InputPrimitive
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      data-slot="input"
      className={cn(inputClass, className)}
      {...props}
      value={formatWithCommas(raw)}
      onChange={handleChange}
    />
  )
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "number") return <NumberInput className={className} {...props} />
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputClass, className)}
      {...props}
    />
  )
}

export { Input }
