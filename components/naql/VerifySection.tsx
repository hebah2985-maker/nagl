'use client'

import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CitationStatus, DiffSegment, VerificationResult } from '@/lib/api'
import { useStore } from '@/lib/store'
import { openSourceAtChunk } from './viewer-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'

const STATUS_INFO: Record<
  CitationStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  matched: {
    label: 'مطابق بالكامل',
    icon: CheckCircle2,
    className:
      'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  partial: {
    label: 'مطابق جزئيًا',
    icon: CircleDashed,
    className:
      'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  },
  not_found: {
    label: 'لم يتم العثور عليه',
    icon: XCircle,
    className:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200',
  },
}

export function VerifySection() {
  // Select userSources as a stable reference; compute indexed sources via useMemo
  // to avoid creating a new array on every store notification (which would
  // trigger an infinite re-render loop in Zustand's useSyncExternalStore).
  const userSources = useStore((s) => s.userSources)
  const indexedSources = useMemo(
    () => userSources.filter((src) => src.status === 'indexed'),
    [userSources],
  )
  const verifySourceId = useStore((s) => s.verifySourceId)
  const setVerifySourceId = useStore((s) => s.setVerifySourceId)
  const verifyResult = useStore((s) => s.verifyResult)
  const loading = useStore((s) => s.verifyLoading)
  const runVerify = useStore((s) => s.runVerify)
  const loadLibrary = useStore((s) => s.loadLibrary)

  const [text, setText] = useState('')

  useEffect(() => {
    if (indexedSources.length === 0) loadLibrary()
  }, [indexedSources.length, loadLibrary])

  // Auto-select the first indexed source when the verify page loads if no
  // source is selected. This helps automated tests that can't interact with
  // the custom radix Select dropdown, and also improves UX for users who
  // just want to paste a quote and verify quickly.
  useEffect(() => {
    if (!verifySourceId && indexedSources.length > 0) {
      setVerifySourceId(indexedSources[0].id)
    }
  }, [verifySourceId, indexedSources, setVerifySourceId])

  function handleVerify() {
    if (!verifySourceId || !text.trim()) return
    runVerify(text, verifySourceId)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="space-y-1">
        <h2 className="font-arabic text-2xl font-bold">تحقق من اقتباس</h2>
        <p className="text-sm text-muted-foreground">
          ألصق نصًا اقتبسته من مصدر، وحدد المصدر، ليتحقق النظام من مطابقته للمقطع
          الأصلي ويُظهر الفروق.
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="vtext">النص المُقتبَس</Label>
            <Textarea
              id="vtext"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="ألصق النص الذي تريد التحقق منه."
              className="min-h-40 font-classical text-base leading-8"
            />
            <p className="text-xs text-muted-foreground">
              الحد الأدنى: 3 أحرف.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vsrc">المصدر</Label>
            <Select
              value={verifySourceId || ''}
              onValueChange={(v) => setVerifySourceId(v)}
              disabled={indexedSources.length === 0}
            >
              <SelectTrigger id="vsrc" className="w-full">
                <SelectValue
                  placeholder={
                    indexedSources.length === 0
                      ? 'لا توجد مصادر مفهرسة'
                      : 'اختر المصدر'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {indexedSources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {s.author ? ` — ${s.author}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleVerify}
              disabled={loading || !verifySourceId || !text.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  تحقق
                </>
              )}
            </Button>
            {verifySourceId && text.trim() && !loading && (
              <span className="text-xs text-muted-foreground">
                سيُقارن النص مع المقاطع المفهرسة للمصدر.
              </span>
            )}
          </div>
        </div>
      </Card>

      {loading && <VerifySkeleton />}

      {!loading && verifyResult && (
        <VerifyResultView result={verifyResult} userText={text} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function VerifySkeleton() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        جاري التحقق من الاقتباس...
      </div>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Result view                                                          */
/* ------------------------------------------------------------------ */

function VerifyResultView({
  result,
  userText,
}: {
  result: VerificationResult
  userText: string
}) {
  const info = STATUS_INFO[result.status]
  const Icon = info.icon
  // matchRatio is already 0-100 (fuzzball.ratio returns 0-100, citation.ts rounds it)
  const ratioPct = Math.max(0, Math.min(100, Math.round(result.matchRatio || 0)))

  return (
    <div className="space-y-5">
      {/* Status + ratio */}
      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-5" />
              {info.label}
            </CardTitle>
            <Badge variant="outline" className={info.className}>
              {info.label}
            </Badge>
          </div>
          <CardDescription>
            نسبة المطابقة الآلية:{' '}
            <span className="font-arabic text-base font-bold text-foreground">
              {ratioPct}%
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <Progress value={ratioPct} />

          {(result.matchedSource || result.matchedPage != null) && (
            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2">
              {result.matchedSource && (
                <div>
                  <span className="text-muted-foreground">المصدر: </span>
                  <span className="font-medium">{result.matchedSource}</span>
                </div>
              )}
              {result.matchedPage != null && (
                <div>
                  <span className="text-muted-foreground">الصفحة: </span>
                  <span className="font-arabic text-lg font-bold tabular-nums">
                    {result.matchedPage}
                  </span>
                </div>
              )}
            </div>
          )}

          <Alert className="border-primary/30 bg-primary/5">
            <TriangleAlert className="text-primary" />
            <AlertTitle>تنبيه</AlertTitle>
            <AlertDescription>
              هذه النسبة مؤشر آلي أولي وليست حكمًا علميًا مستقلًا. راجع المصدر
              الأصلي للتأكد.
            </AlertDescription>
          </Alert>

          {result.note && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
              {result.note}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2 rounded-full bg-primary" />
            النص المدخل
          </div>
          <p className="font-classical max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-8 text-foreground/90 scrollbar-thin">
            {userText}
          </p>
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2 rounded-full bg-emerald-500" />
            النص الأصلي
          </div>
          {result.matchedText ? (
            <p className="font-classical max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-8 text-foreground/90 scrollbar-thin">
              {result.matchedText}
            </p>
          ) : (
            <Alert className="border-amber-300 bg-amber-50 text-amber-800 text-xs dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              تعذّر استخراج النص الأصلي بدقة. قد تكون الصفحة تعتمد على OCR أو لا
              توجد مقاطع مفهرسة مطابقة.
            </Alert>
          )}
        </Card>
      </div>

      {/* Diff */}
      {result.differences && result.differences.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">الفروق بين النصّين</CardTitle>
            <CardDescription className="text-xs">
              <span className="ms-1 inline-block rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">إضافة</span>
              {' '}
              <span className="ms-1 inline-block rounded bg-red-500/20 px-1.5 py-0.5 text-red-700 line-through dark:text-red-300">حذف</span>
              {' '}
              <span className="ms-1 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">تغيير</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p
              dir="rtl"
              className="font-classical text-base leading-10 text-foreground"
            >
              {result.differences.map((seg, i) => (
                <span key={i}>
                  {i > 0 ? ' ' : ''}
                  <DiffSpan seg={seg} />
                </span>
              ))}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Open original page */}
      {result.matchedChunkId && (
        <div className="flex justify-center">
          <OpenOriginalButton
            chunkId={result.matchedChunkId}
            page={result.matchedPage || 1}
            matchedText={result.matchedText || ''}
          />
        </div>
      )}
    </div>
  )
}

function DiffSpan({ seg }: { seg: DiffSegment }) {
  if (!seg || !seg.text) return null
  if (seg.type === 'add') return <span className="diff-add">{seg.text}</span>
  if (seg.type === 'remove')
    return <span className="diff-remove">{seg.text}</span>
  if (seg.type === 'change')
    return <span className="diff-change">{seg.text}</span>
  return <span>{seg.text}</span>
}

function OpenOriginalButton({
  chunkId,
  page,
  matchedText,
}: {
  chunkId: string
  page: number
  matchedText: string
}) {
  // We don't have the source id at this level, but matchedChunkId is the chunk's id.
  // The viewer can locate the chunk by id (which encodes the source via DB).
  // To open the viewer at the right source, look it up via the active verifySourceId.
  const verifySourceId = useStore((s) => s.verifySourceId)

  function open() {
    if (!verifySourceId) return
    void matchedText
    openSourceAtChunk(verifySourceId, page, chunkId)
  }

  if (!verifySourceId) return null
  return (
    <Button onClick={open} variant="default">
      فتح الصفحة الأصلية
    </Button>
  )
}
