'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, LogIn, UserPlus, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '@/lib/store'

export function AuthDialog() {
  const open = useStore((s) => s.authDialogOpen)
  const setOpen = useStore((s) => s.setAuthDialogOpen)
  const mode = useStore((s) => s.authDialogMode)
  const setMode = useStore((s) => s.setAuthDialogMode)
  const authLoading = useStore((s) => s.authLoading)
  const signUpStore = useStore((s) => s.signUp)
  const loadUser = useStore((s) => s.loadUser)

  // Local form state — kept simple; we don't reset on close to keep typed text
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور.')
      return
    }
    setBusy(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (!res || res.error) {
        const msg = res?.error || 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
        toast.error(decodeNextAuthError(msg))
      } else {
        toast.success('تم تسجيل الدخول بنجاح.')
        setEmail('')
        setPassword('')
        setName('')
        setOpen(false)
        await loadUser()
      }
    } catch (err: any) {
      toast.error('تعذّر تسجيل الدخول. ' + String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور.')
      return
    }
    setBusy(true)
    try {
      const out = await signUpStore(email.trim().toLowerCase(), password, name.trim())
      if (!out.ok) {
        toast.error(out.error || 'تعذّر إنشاء الحساب.')
        return
      }
      // Auto-login after signup
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (!res || res.error) {
        // Signup succeeded but auto-login failed — switch to login tab so user
        // can sign in manually.
        toast.success('تم إنشاء الحساب. سجّل الدخول الآن.')
        setMode('login')
        setPassword('')
      } else {
        toast.success('تم إنشاء الحساب وتسجيل الدخول بنجاح.')
        setEmail('')
        setPassword('')
        setName('')
        setOpen(false)
        await loadUser()
      }
    } catch (err: any) {
      toast.error('تعذّر إنشاء الحساب. ' + String(err?.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {mode === 'login'
              ? 'سجّل دخولك للمتابعة إلى مكتبتك وبحثك الموثّق.'
              : 'أنشئ حسابًا لحفظ مكتبتك وعمليات التحقق والتحليل.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as 'login' | 'signup')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="gap-1.5">
              <LogIn className="size-4" />
              دخول
            </TabsTrigger>
            <TabsTrigger value="signup" className="gap-1.5">
              <UserPlus className="size-4" />
              تسجيل
            </TabsTrigger>
          </TabsList>

          {/* LOGIN */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <FormField
                id="login-email"
                label="البريد الإلكتروني"
                type="email"
                icon={<Mail className="size-4" />}
                value={email}
                onChange={setEmail}
                placeholder="name@example.com"
                autoComplete="email"
                dir="ltr"
              />
              <FormField
                id="login-password"
                label="كلمة المرور"
                type="password"
                icon={<Lock className="size-4" />}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
                dir="ltr"
              />
              <Button
                type="submit"
                className="w-full"
                disabled={busy || authLoading}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                <span className="ms-1.5">دخول</span>
              </Button>
            </form>
          </TabsContent>

          {/* SIGNUP */}
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <FormField
                id="signup-name"
                label="الاسم (اختياري)"
                type="text"
                icon={<User className="size-4" />}
                value={name}
                onChange={setName}
                placeholder="اسمك"
                autoComplete="name"
              />
              <FormField
                id="signup-email"
                label="البريد الإلكتروني"
                type="email"
                icon={<Mail className="size-4" />}
                value={email}
                onChange={setEmail}
                placeholder="name@example.com"
                autoComplete="email"
                dir="ltr"
              />
              <FormField
                id="signup-password"
                label="كلمة المرور (6 أحرف على الأقل)"
                type="password"
                icon={<Lock className="size-4" />}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="new-password"
                dir="ltr"
              />
              <Button
                type="submit"
                className="w-full"
                disabled={busy || authLoading}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                <span className="ms-1.5">إنشاء الحساب</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2 text-center text-xs text-muted-foreground">
          <p>
            {mode === 'login'
              ? 'ليس لديك حساب؟ اضغط على «تسجيل» في الأعلى.'
              : 'لديك حساب بالفعل؟ اضغط على «دخول» في الأعلى.'}
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormField({
  id,
  label,
  type,
  icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  dir,
}: {
  id: string
  label: string
  type: string
  icon: React.ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
          {icon}
        </div>
        <Input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          dir={dir}
          className="ps-9"
        />
      </div>
    </div>
  )
}

// NextAuth returns English error messages from our authorize() throw. We map
// the known ones back to Arabic. (Our backend already throws Arabic, but we
// double-check here in case of generic credentials errors.)
function decodeNextAuthError(msg: string): string {
  if (!msg) return 'تعذّر تسجيل الدخول.'
  if (/incorrect|invalid|not found|no user/i.test(msg)) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }
  if (/csrf|CSRF/i.test(msg)) return 'انتهت الجلسة. حاول مرة أخرى.'
  return msg
}
