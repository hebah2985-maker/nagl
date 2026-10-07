'use client'

import {
  BookPlus,
  FileSearch,
  FileText,
  Layers,
  Library,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SYSTEM_PROHIBITIONS } from './labels'

const STEPS: Array<{ n: number; title: string; desc: string; icon: typeof Layers }> = [
  {
    n: 1,
    title: 'أضف المصدر',
    desc: 'ارفع ملف PDF لمصدر علمي معتمد، وحدّد بياناته ونوعه.',
    icon: BookPlus,
  },
  {
    n: 2,
    title: 'ابحث بذكاء',
    desc: 'اكتب سؤالك فيصنّفه النظام ويسترجع المقاطع ذات الصلة.',
    icon: Search,
  },
  {
    n: 3,
    title: 'استخرج الأدلة',
    desc: 'كل نتيجة تُربط بالمصدر والصفحة والمقطع الأصلي.',
    icon: FileText,
  },
  {
    n: 4,
    title: 'تحقق من الاقتباس',
    desc: 'ألصق أي نص فيقارنه النظام بالمصدر ويعرض الفروق.',
    icon: ShieldCheck,
  },
  {
    n: 5,
    title: 'ارجع إلى الموضع الأصلي',
    desc: 'انتقل مباشرة إلى الصفحة والمقاطع المؤسِّسة للإجابة.',
    icon: Target,
  },
]

export function HomeSection() {
  const setSection = useStore((s) => s.setSection)
  const stats = useStore((s) => s.stats)
  const loadStats = useStore((s) => s.loadStats)

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* HERO */}
      <section className="pattern-navy overflow-hidden rounded-2xl border bg-card p-6 sm:p-10">
        <div className="max-w-3xl space-y-5">
          <Badge
            variant="outline"
            className="border-primary/30 bg-primary/5 text-primary"
          >
            <Sparkles className="size-3.5" />
            منصة بحث وتوثيق مبنية على المصادر
          </Badge>
          <h2 className="font-arabic text-4xl font-bold tracking-tight sm:text-5xl">
            نقل محقق
          </h2>
          <p className="text-lg text-muted-foreground sm:text-xl">
            ابحث، اقتبس، وتحقق من مصادرك بثقة.
          </p>
          <p className="text-sm leading-7 text-foreground/80 sm:text-base">
            منصة بحث وتوثيق ذكية تساعد طلاب العلم والباحثين على الوصول إلى
            النصوص الشرعية، وتحليلها، والتحقق من الاقتباسات مع ربط كل نتيجة بمصدرها
            وموضعها الأصلي. لا يَختلق النظام آيةً ولا حديثًا ولا صفحة، ولا يَفتي
            برأي مستقل، ولا يَعتمد على ذاكرة النموذج كمصدر.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => setSection('search')}>
              <Search className="size-4" />
              ابدأ البحث
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setSection('library')}
            >
              <BookPlus className="size-4" />
              أضف مصدرًا
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setSection('verify')}
            >
              <ShieldCheck className="size-4" />
              تحقق من اقتباس
            </Button>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="space-y-4">
        <header className="space-y-1">
          <h3 className="font-arabic text-2xl font-bold">كيف تعمل المنصة؟</h3>
          <p className="text-sm text-muted-foreground">
            خمس خطوات من المصدر إلى الدليل.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => {
            const Icon = s.icon
            return (
              <Card key={s.n} className="relative gap-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-arabic text-3xl font-bold text-muted-foreground/30">
                    {s.n}
                  </span>
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {s.title}
                  </CardTitle>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* TRUST PANEL */}
      <section className="space-y-4">
        <header className="space-y-1">
          <h3 className="font-arabic text-2xl font-bold">شاشة الثقة</h3>
          <p className="text-sm text-muted-foreground">
            أرقام حيّة من قاعدة بيانات المنصة.
          </p>
        </header>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="المصادر"
            value={stats?.sources ?? 0}
            icon={<Library className="size-5" />}
          />
          <StatCard
            label="المقاطع المفهرسة"
            value={stats?.chunks ?? 0}
            icon={<Layers className="size-5" />}
          />
          <StatCard
            label="عمليات البحث"
            value={stats?.searches ?? 0}
            icon={<FileSearch className="size-5" />}
          />
          <StatCard
            label="اقتباسات مطابقة"
            value={stats?.verifiedMatched ?? 0}
            icon={<ShieldCheck className="size-5" />}
            highlight="emerald"
          />
          <StatCard
            label="اقتباسات جزئية"
            value={stats?.verifiedPartial ?? 0}
            icon={<Quote className="size-5" />}
            highlight="amber"
          />
        </div>
      </section>

      {/* PROHIBITIONS */}
      <section>
        <Alert className="border-primary/30 bg-primary/5">
          <TriangleAlert className="text-primary" />
          <AlertTitle className="font-arabic text-base font-semibold">
            ما لا يفعله النظام
          </AlertTitle>
          <AlertDescription>
            <ul className="grid gap-1.5 pt-1 text-sm">
              {SYSTEM_PROHIBITIONS.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span className="text-foreground/80">{p}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: 'emerald' | 'amber'
}) {
  const tone =
    highlight === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : highlight === 'amber'
        ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : 'border-border bg-card text-foreground'
  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <div className="mt-2 font-arabic text-3xl font-bold tabular-nums">
        {value}
      </div>
    </div>
  )
}
