import type { Metadata } from 'next'
import { Questrial } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const questrial = Questrial({ subsets: ['latin'], weight: '400' })

export const metadata: Metadata = {
  title: 'CDSC Industrial Supply — ERP System',
  description: 'Enterprise Resource Planning — Inventory, Purchasing, Warehouse & BIR Compliance',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className={`${questrial.className} min-h-full bg-background text-foreground`}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
