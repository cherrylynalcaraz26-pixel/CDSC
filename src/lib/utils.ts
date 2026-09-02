import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// csi_records.dr_number is stored as a single comma-separated text field
// (e.g. "DR-0001, DR-0002") so one Sales Invoice can reference deliveries
// spread across multiple DRs. Shared by CSI Monitoring and DR Logs.
export function parseDrNumbers(value: string | null | undefined): string[] {
  return (value ?? '').split(',').map(s => s.trim()).filter(Boolean)
}
