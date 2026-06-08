import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Velox | Swap tokens on Base',
  description: 'Swap any token on Base instantly',
  icons: { icon: '/favicon.png' },
  other: {
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: 'https://velox-base.vercel.app/favicon.png',
      button: {
        title: 'Swap To kens',
        action: {
          type: 'launch_frame',
          name: 'Velox',
          url: 'https://velox-base.vercel.app',
          splashImageUrl: 'https://velox-base.vercel.app/favicon.png',
          splashBackgroundColor: '#f0eeff',
        },
      },
    }),
    'base:app_id': '6a25496195cfa95c11629bc3',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  )
}