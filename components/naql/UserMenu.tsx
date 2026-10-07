'use client'

import { useState, useSyncExternalStore } from 'react'
import { LogIn, LogOut, ChevronDown, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useStore } from '@/lib/store'
import { toast } from 'sonner'

// Track "has mounted on client" via useSyncExternalStore to avoid the
// setState-in-effect lint rule (and hydration mismatches).
const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function UserMenu() {
  const user = useStore((s) => s.user)
  const setAuthDialogOpen = useStore((s) => s.setAuthDialogOpen)
  const setAuthDialogMode = useStore((s) => s.setAuthDialogMode)
  const signOutStore = useStore((s) => s.signOut)
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)
  const [open, setOpen] = useState(false)

  if (!mounted) {
    // Placeholder with the same dimensions to avoid layout shift
    return <div className="h-9 w-24 animate-pulse rounded-md bg-muted" aria-hidden />
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2.5"
          onClick={() => {
            setAuthDialogMode('login')
            setAuthDialogOpen(true)
          }}
        >
          <LogIn className="size-4" />
          <span className="hidden sm:inline">دخول</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 px-2.5"
          onClick={() => {
            setAuthDialogMode('signup')
            setAuthDialogOpen(true)
          }}
        >
          <span className="hidden sm:inline">حساب جديد</span>
        </Button>
      </div>
    )
  }

  const initials = (user.name || user.email || '?')
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    setOpen(false)
    await signOutStore()
    toast.success('تم تسجيل الخروج بنجاح.')
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 px-2 py-1.5"
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary text-primary-foreground text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-xs sm:inline">
            {user.name || user.email}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium">
            {user.name || 'بدون اسم'}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {user.email}
          </span>
          <Badge
            variant="secondary"
            className="mt-1 w-fit gap-1 text-[10px]"
          >
            <ShieldCheck className="size-3" />
            {user.role === 'admin' ? 'مدير' : 'مستخدم'}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer gap-2 text-red-600 focus:text-red-700 dark:text-red-400"
        >
          <LogOut className="size-4" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
