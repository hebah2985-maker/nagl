'use client'

import { BookMarked, FlaskConical } from 'lucide-react'
import { useStore } from '@/lib/store'
import { ThemeToggle } from './ThemeToggle'
import { NavTabs } from './NavTabs'
import { UserMenu } from './UserMenu'
import { AuthDialog } from './AuthDialog'

export function AppShell({ children }: { children: React.ReactNode }) {
  const stats = useStore((s) => s.stats)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
              aria-hidden
            >
              <BookMarked className="size-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="font-arabic text-lg font-bold leading-tight sm:text-xl">
                نقل محقق
              </h1>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                من المصدر إلى الدليل
              </p>
            </div>
          </div>

          {/* Right cluster: stats chip + trial badge + user menu + theme toggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            {stats && (
              <div className="hidden items-center gap-2 rounded-full border bg-secondary/60 px-3 py-1 text-xs text-secondary-foreground md:flex">
                <span>
                  المصادر: <span className="font-semibold">{stats.sources}</span>
                </span>
                <span className="text-muted-foreground">•</span>
                <span>
                  المقاطع: <span className="font-semibold">{stats.chunks}</span>
                </span>
                <span className="text-muted-foreground">•</span>
                <span>
                  التحقق:{' '}
                  <span className="font-semibold">
                    {stats.verifiedMatched + stats.verifiedPartial}
                  </span>
                </span>
              </div>
            )}
            <div className="hidden items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 lg:inline-flex dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              <FlaskConical className="size-3" />
              <span>تجريبي</span>
            </div>
            <UserMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <NavTabs />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 sm:text-sm">
          نقل محقق لا يستبدل الباحث؛ بل يساعده على الوصول إلى الدليل والتحقق منه.
        </div>
      </footer>

      <AuthDialog />
    </div>
  )
}
