'use client'

import { Home, Library, Search, ShieldCheck } from 'lucide-react'
import { useStore, type Section } from '@/lib/store'
import { cn } from '@/lib/utils'

interface TabDef {
  id: Section
  label: string
  icon: typeof Home
}

const TABS: TabDef[] = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'library', label: 'المكتبة', icon: Library },
  { id: 'search', label: 'البحث', icon: Search },
  { id: 'verify', label: 'التحقق', icon: ShieldCheck },
]

export function NavTabs() {
  const section = useStore((s) => s.section)
  const setSection = useStore((s) => s.setSection)

  return (
    <nav
      role="tablist"
      aria-label="أقسام المنصة"
      className="sticky top-[57px] z-30 bg-background/95 backdrop-blur border-b"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-thin">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = section === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSection(t.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-accent/10 hover:text-accent-foreground',
              )}
            >
              <Icon className="size-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
