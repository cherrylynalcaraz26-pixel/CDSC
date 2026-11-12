import type { Metadata } from 'next'
import { Questrial } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ConfirmHost } from '@/components/ui/confirm'
import { ActivityIndicator } from '@/components/activity-indicator'

const questrial = Questrial({ subsets: ['latin'], weight: '400' })

export const metadata: Metadata = {
  title: 'CDSC Industrial Supply — ERP',
  description: 'Enterprise Resource Planning — Inventory, Purchasing, Warehouse & BIR Compliance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${questrial.className} min-h-full bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
        <ConfirmHost />
        <ActivityIndicator />
      </body>
    </html>
  )
}
