'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider session={null} refetchOnWindowFocus={true}>{children}</SessionProvider>
}
