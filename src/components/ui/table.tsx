"use client"

import * as React from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

// `containerClassName` merges onto the table's own scroll wrapper rather than
// adding a separate outer div. A sticky <TableHeader> resolves its position
// against the *nearest* ancestor with non-visible overflow — an extra outer
// wrapper would lose to this div's own `overflow-x-auto` (which forces
// `overflow-y` to compute as `auto` too), and since that inner div always
// sizes itself exactly to its content it never actually scrolls, so the
// sticky header would have nothing to stick against. Putting both concerns
// on one div fixes that: pass e.g. `max-h-[600px] overflow-y-auto` here for a
// bounded local scrollbox, or `overflow-x-clip` to give up horizontal scroll
// and let the header stick to the page's own scroll instead.
function Table({ className, containerClassName, ...props }: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", containerClassName)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/40 [&_tr]:border-b [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

// Clickable TableHead that shows a sort-direction indicator — pair with the
// `useTableSort` hook (src/lib/use-table-sort.ts) for the sort state/comparator.
function SortableTableHead<K extends string>({
  label, sortKey, activeKey, direction, onSort, className, align,
}: {
  label: React.ReactNode
  sortKey: K
  activeKey: K | null
  direction: 'asc' | 'desc'
  onSort: (key: K) => void
  className?: string
  align?: 'right'
}) {
  const active = activeKey === sortKey
  return (
    <TableHead
      className={cn(align === 'right' && 'text-right', 'cursor-pointer select-none hover:text-foreground', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        {active
          ? (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
      </span>
    </TableHead>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  SortableTableHead,
}
