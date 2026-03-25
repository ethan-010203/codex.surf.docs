import type { Metadata } from 'next'
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google'

import '@/lib/server-runtime'

import './globals.css'

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
})

const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'codex_surf',
  description: 'codex_surf activation console and admin backend',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='zh-CN'
      suppressHydrationWarning
      className={`${displayFont.variable} ${monoFont.variable}`}
    >
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
