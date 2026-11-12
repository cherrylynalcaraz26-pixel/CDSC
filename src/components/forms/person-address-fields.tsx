'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Address, PersonName } from '@/lib/person-address'

/** First / Middle / Last name inputs in one row. */
export function NameFields({
  value, onChange, label, required = false, className, inputClassName,
}: {
  value: PersonName
  onChange: (v: PersonName) => void
  label?: string
  required?: boolean
  className?: string
  inputClassName?: string
}) {
  const set = (k: keyof PersonName) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  return (
    <fieldset className={cn('space-y-1.5', className)}>
      {label && (
        <legend className="mb-1.5 text-sm font-medium">
          {label}{required && <span className="text-destructive"> *</span>}
        </legend>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">First Name</Label>
          <Input className={inputClassName} value={value.first} onChange={set('first')} placeholder="Juan" autoComplete="given-name" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Middle Name</Label>
          <Input className={inputClassName} value={value.middle} onChange={set('middle')} placeholder="Santos" autoComplete="additional-name" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Last Name</Label>
          <Input className={inputClassName} value={value.last} onChange={set('last')} placeholder="dela Cruz" autoComplete="family-name" />
        </div>
      </div>
    </fieldset>
  )
}

/** Address No. / Street / Barangay / Municipality / City inputs. */
export function AddressFields({
  value, onChange, label = 'Address', required = false, className, inputClassName,
}: {
  value: Address
  onChange: (v: Address) => void
  label?: string
  required?: boolean
  className?: string
  inputClassName?: string
}) {
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value })
  return (
    <fieldset className={cn('space-y-1.5', className)}>
      {label && (
        <legend className="mb-1.5 text-sm font-medium">
          {label}{required && <span className="text-destructive"> *</span>}
        </legend>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Address No.</Label>
          <Input className={inputClassName} value={value.no} onChange={set('no')} placeholder="113" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Street</Label>
          <Input className={inputClassName} value={value.street} onChange={set('street')} placeholder="San Isidro Road" autoComplete="address-line1" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Barangay</Label>
          <Input className={inputClassName} value={value.barangay} onChange={set('barangay')} placeholder="San Isidro Sur" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label className="text-xs text-muted-foreground">Municipality</Label>
          <Input className={inputClassName} value={value.municipality} onChange={set('municipality')} placeholder="Sto. Tomas" autoComplete="address-level3" />
        </div>
        <div className="space-y-1 col-span-2 sm:col-span-3">
          <Label className="text-xs text-muted-foreground">City / Province</Label>
          <Input className={inputClassName} value={value.city} onChange={set('city')} placeholder="Batangas" autoComplete="address-level2" />
        </div>
      </div>
    </fieldset>
  )
}
