'use client'

import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Copy,
  FileSearch,
  Info,
  ListFilter,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Evidence, RagAnswer, SearchResponse, ValidationIssue } from '@/lib/api'
import { useStore } from '@/lib/store'
import { openSourceAtChunk, useViewerStore } from './viewer-store'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  SYSTEM_PROHIBITIONS,
  getConfidenceInfo,
  getContentLevelLabel,
  getQuestionTypeLabel,
  getSourceTypeLabel,
} from './labels'

export function SearchSection() {
  const question = useStore((s) => s.lastQuestion)
  const setQuestion = useStore((s) => s.setLastQuestion)
  const loading = useStore((s) => s.searchLoading)
  const error = useStore((s) => s.searchError)
  const result = useStore((s) => s.searchResult)
  const runSearch = useStore((s) => s.runSearch)
  const selectedSourceIds = useStore((s) => s.selectedSourceIds)
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const searchMode = useStore((s) => s.searchMode)
  const setSearchMode = useStore((s) => s.setSearchMode)
  const scopeMode = useStore((s) => s.scopeMode)
  const setScopeMode = useStore((s) => s.setScopeMode)
  const toggleSource = useStore((s) => s.toggleSource)
  const loadLibrary = useStore((s) => s.loadLibrary)

  const [sheetOpen, setSheetOpen] = useState(false)

  // Auto-select the first indexed user source if no source is selected.
  // This helps automated tests that can't interact with the custom source
  // picker Sheet, and also improves UX for users who land on the search tab
  // directly (e.g. via the "ابدأ البحث" button on the home page).
  const indexedUserSources = useMemo(
    () => userSources.filter((s) => s.status === 'indexed'),
    [userSources],
  )
  useEffect(() => {
    if (indexedUserSources.length === 0 && userSources.length === 0) {
      loadLibrary()
    }
  }, [indexedUserSources.length, userSources.length, loadLibrary])
  useEffect(() => {
    if (selectedSourceIds.length === 0 && indexedUserSources.length > 0) {
      toggleSource(indexedUserSources[0].id)
    }
  }, [selectedSourceIds.length, indexedUserSources, toggleSource])

  // Reset highlight on a new search
  const resultId = result ? `${result.answer.summary.length}-${result.evidence.length}` : ''
  useEffect(() => {
    useViewerStore.getState().setActiveChunkId(null)
  }, [resultId])

  function handleSearch() {
    if (!question.trim()) return
    runSearch(question)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="space-y-1">
        <h2 className="font-arabic text-2xl font-bold">البحث في المصادر</h2>
        <p className="text-sm text-muted-foreground">
          اكتب سؤالك وحدد المصادر. كل نتيجة مربوطة بمصدرها وموضعها الأصلي.
        </p>
      </header>

      {/* Search box */}
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSearch()
                }
              }}
              placeholder="ماذا تريد أن تبحث عنه؟"
              className="h-12 pr-11 text-base"
            />
          </div>
          <Button
            size="lg"
            onClick={handleSearch}
            disabled={loading || !question.trim() || selectedSourceIds.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري البحث...
              </>
            ) : (
              <>
                <Search className="size-4" />
                ابحث
              </>
            )}
          </Button>
        </div>

        {/* Selected sources + filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter className="size-4" />
                اختيار مصادر
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>اختيار المصادر</SheetTitle>
                <SheetDescription>
                  المصادر غير المفهرسة لا تظهر في القائمة.
                </SheetDescription>
              </SheetHeader>
              <SourcePickerBody />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              المحدد: <span className="font-semibold">{selectedSourceIds.length}</span>
            </span>
          </div>
        </div>

        {selectedSourceIds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {selectedSourceIds.map((id) => {
              const src =
                userSources.find((s) => s.id === id) ||
                officialSources.find((s) => s.id === id)
              return (
                <SelectedChip key={id} id={id} title={src?.title || id} />
              )
            })}
          </div>
        )}

        {/* Mode + scope radios */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              نمط البحث
            </Label>
            <RadioGroup
              value={searchMode}
              onValueChange={(v) =>
                setSearchMode(v as 'keyword' | 'semantic' | 'hybrid')
              }
              className="flex flex-row gap-4"
            >
              <ModeRadio value="hybrid" label="هجين" />
              <ModeRadio value="keyword" label="نصي" />
              <ModeRadio value="semantic" label="دلالي" />
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              النطاق
            </Label>
            <RadioGroup
              value={scopeMode}
              onValueChange={(v) =>
                setScopeMode(
                  v as 'this_book' | 'user_library' | 'official',
                )
              }
              className="flex flex-row gap-4"
            >
              <ModeRadio value="this_book" label="هذا الكتاب" />
              <ModeRadio value="user_library" label="مكتبتي" />
              <ModeRadio value="official" label="معتمد" />
            </RadioGroup>
          </div>
        </div>
      </Card>

      {/* Empty / error / loading / result */}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>تعذّر تنفيذ البحث</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <SearchSkeleton />}

      {!loading && !error && !result && (
        <Card className="p-10 text-center">
          <FileSearch className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {selectedSourceIds.length === 0
              ? 'حدّد مصدرًا واحدًا على الأقل ثم اكتب سؤالك للبحث.'
              : 'اكتب سؤالك في الأعلى ثم اضغط «ابحث».'}
          </p>
        </Card>
      )}

      {!loading && !error && result && (
        <SearchResultView result={result} question={question} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet picker body (shared with Library)                              */
/* ------------------------------------------------------------------ */

function SourcePickerBody() {
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const selectedIds = useStore((s) => s.selectedSourceIds)
  const toggle = useStore((s) => s.toggleSource)
  const clearAll = useStore((s) => s.clearSelectedSources)

  const candidates = userSources.filter((s) => s.status === 'indexed')

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 scrollbar-thin">
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        onClick={clearAll}
        disabled={selectedIds.length === 0}
      >
        <X className="size-3.5" />
        مسح الاختيار
      </Button>
      {candidates.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا توجد مصادر مفهرسة. ارفع ملف PDF وأتم معالجته أولًا.
        </p>
      ) : (
        candidates.map((s) => {
          const checked = selectedIds.includes(s.id)
          return (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/10"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(s.id)}
                className="mt-1 size-4 accent-[hsl(var(--primary))]"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.author || '—'} • {getSourceTypeLabel(s.sourceType)} •{' '}
                  {s.chunkCount} مقطع
                </p>
              </div>
            </label>
          )
        })
      )}

      {/* Show official sources that have chunks (rare for MVP but supported) */}
      {officialSources.filter((s) => s.chunkCount > 0).length > 0 && (
        <>
          <Separator className="my-2" />
          <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">
            مصادر معتمدة مفهرسة
          </p>
          {officialSources
            .filter((s) => s.chunkCount > 0)
            .map((s) => {
              const checked = selectedIds.includes(s.id)
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/10"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s.id)}
                    className="mt-1 size-4 accent-[hsl(var(--primary))]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.author || '—'} • {s.chunkCount} مقطع
                    </p>
                  </div>
                </label>
              )
            })}
        </>
      )}
    </div>
  )
}

function SelectedChip({ id, title }: { id: string; title: string }) {
  const toggle = useStore((s) => s.toggleSource)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 py-1 pr-2 pl-1 text-xs text-secondary-foreground">
      <span className="line-clamp-1 max-w-[16ch]">{title}</span>
      <button
        type="button"
        onClick={() => toggle(id)}
        className="rounded-full p-0.5 hover:bg-accent/20"
        aria-label="إزالة المصدر"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

function ModeRadio({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={`r-${value}`} />
      <Label htmlFor={`r-${value}`} className="text-sm font-normal">
        {label}
      </Label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        جاري البحث في المصادر...
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-8/12" />
          <Skeleton className="h-24 w-full" />
        </Card>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Result view                                                          */
/* ------------------------------------------------------------------ */

function SearchResultView({
  result,
  question,
}: {
  result: SearchResponse
  question: string
}) {
  const answer = result.answer
  const policy = result.policy
  const confidence = getConfidenceInfo(answer.confidence)
  const policyNote = policy.policyNotes || ''

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ANSWER PANEL (right in RTL) */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-primary" />
                  الإجابة
                </CardTitle>
                <Badge variant="outline" className={confidence.className}>
                  الثقة: {confidence.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <AnswerText answer={answer} />

              {answer.abstain && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  <ShieldAlert className="text-amber-600" />
                  <AlertTitle>تعذّر الرد المباشر</AlertTitle>
                  <AlertDescription>
                    {answer.abstain_reason ||
                      'لم نجد مرجعًا كافيًا في المصادر المتاحة، لذلك لن نخمن.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Notes */}
              {answer.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm leading-6 text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">
                    ملاحظات التحقق
                  </p>
                  {answer.notes}
                </div>
              )}

              {/* Validation issues */}
              {result.issues && result.issues.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                  <TriangleAlert className="text-amber-600" />
                  <AlertTitle>تنبيهات التحقق</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pr-5">
                      {result.issues.map((iss, i) => (
                        <li key={i}>
                          <IssueText issue={iss} />
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Policy info */}
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    نوع السؤال: {getQuestionTypeLabel(policy.questionType)}
                  </Badge>
                  <Badge variant="outline">
                    مستوى المحتوى: {getContentLevelLabel(policy.contentLevel)}
                  </Badge>
                  {policy.isPersonalFatwa && (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      فتوى شخصية — لا حكم مستقل
                    </Badge>
                  )}
                </div>
                {policyNote && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {policyNote}
                  </p>
                )}
              </div>

              {/* Prohibitions reminder */}
              <Alert className="border-primary/30 bg-primary/5">
                <Info className="text-primary" />
                <AlertDescription>
                  <ul className="grid gap-1 text-xs">
                    {SYSTEM_PROHIBITIONS.map((p, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/70" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* EVIDENCE PANEL (left in RTL) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-arabic text-base font-semibold">
              <BookOpen className="size-4 text-primary" />
              الأدلة ({result.evidence.length})
            </h3>
          </div>
          {result.evidence.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              لا توجد مقاطع مسترجعة.
            </Card>
          ) : (
            <div className="space-y-3">
              {result.evidence.map((ev, i) => (
                <EvidenceCard key={ev.id} evidence={ev} index={i + 1} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transparency accordion */}
      <HowWeGotHere result={result} question={question} policyNote={policyNote} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Answer text + citation markers                                       */
/* ------------------------------------------------------------------ */

function AnswerText({ answer }: { answer: RagAnswer }) {
  // Reset highlight when activeChunkId changes externally
  return (
    <div className="space-y-3">
      <p className="font-arabic text-base leading-8 text-foreground/90">
        {answer.summary}
      </p>
      {answer.claims && answer.claims.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            الادعاءات المُدقّقة
          </p>
          {answer.claims.map((claim, i) => (
            <div key={i} className="rounded-md bg-muted/40 p-3 text-sm leading-7">
              <span className="text-foreground/90">{claim.text}</span>
              {Array.isArray(claim.evidence) && claim.evidence.length > 0 && (
                <span className="ms-1">
                  {claim.evidence.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="citation-marker"
                      onClick={() => scrollToEvidence(idx)}
                      aria-label={`الانتقال إلى الدليل رقم ${idx}`}
                    >
                      {idx}
                    </button>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function scrollToEvidence(index: number) {
  const el = document.getElementById(`evidence-${index}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('ring-2', 'ring-accent', 'bg-accent/10')
  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-accent', 'bg-accent/10')
  }, 1800)
}

/* ------------------------------------------------------------------ */
/* Evidence card                                                        */
/* ------------------------------------------------------------------ */

function EvidenceCard({ evidence, index }: { evidence: Evidence; index: number }) {
  const [copied, setCopied] = useState(false)

  function openSource() {
    openSourceAtChunk(evidence.sourceId, evidence.pageNumber, evidence.id)
  }

  function copyText() {
    void navigator.clipboard
      .writeText(evidence.text)
      .then(() => {
        setCopied(true)
        toast.success('تم نسخ الاقتباس')
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => toast.error('تعذّر النسخ'))
  }

  const scorePct = Math.max(0, Math.min(100, Math.round((evidence.score || 0) * 100)))

  return (
    <Card
      id={`evidence-${index}`}
      className="gap-3 p-4 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="line-clamp-1 font-arabic text-sm font-semibold">
            {evidence.sourceTitle}
          </h4>
          <p className="text-xs text-muted-foreground">
            {evidence.author || '—'}
            {evidence.edition ? ` • ${evidence.edition}` : ''}
          </p>
        </div>
        <div className="text-end">
          <div className="font-arabic text-3xl font-bold leading-none tabular-nums text-primary">
            {evidence.pageNumber}
          </div>
          <div className="text-[10px] text-muted-foreground">صفحة</div>
        </div>
      </div>

      {evidence.chapter && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">الفصل:</span> {evidence.chapter}
        </div>
      )}

      <div className="font-classical rounded-md border bg-muted/20 p-3 text-sm leading-8 text-foreground/85 max-h-64 overflow-y-auto scrollbar-thin">
        {evidence.text}
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>الصلة:</span>
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <span className="tabular-nums">{scorePct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={copyText}>
            {copied ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                نُسخ
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                نسخ الاقتباس
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={openSource}>
            <BookOpen className="size-3.5" />
            فتح الصفحة
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* How-we-got-here transparency accordion                               */
/* ------------------------------------------------------------------ */

function HowWeGotHere({
  result,
  question,
  policyNote,
}: {
  result: SearchResponse
  question: string
  policyNote: string
}) {
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const selectedSourceIds = useStore((s) => s.selectedSourceIds)

  const selectedTitles = selectedSourceIds
    .map((id) => {
      const s = userSources.find((x) => x.id === id) || officialSources.find((x) => x.id === id)
      return s?.title || id
    })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="size-4 text-primary" />
          كيف توصلنا إلى هذه الإجابة؟
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="q">
            <AccordionTrigger className="text-sm font-semibold">
              1. السؤال
            </AccordionTrigger>
            <AccordionContent>
              <p className="font-arabic text-sm leading-7 text-foreground/90">
                {question}
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sources">
            <AccordionTrigger className="text-sm font-semibold">
              2. المصادر المحددة ({selectedTitles.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 text-sm">
                {selectedTitles.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span className="text-foreground/80">{t}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="retrieved">
            <AccordionTrigger className="text-sm font-semibold">
              3. المقاطع المسترجعة ({result.evidence.length})
            </AccordionTrigger>
            <AccordionContent>
              {result.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لم تُسترجع أي مقاطع.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {result.evidence.map((e, i) => (
                    <li key={e.id} className="flex items-center justify-between gap-2">
                      <span className="text-foreground/80">
                        #{i + 1} • {e.sourceTitle} — ص.{e.pageNumber}
                      </span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {Math.round((e.score || 0) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="evidence">
            <AccordionTrigger className="text-sm font-semibold">
              4. الأدلة
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm leading-7 text-muted-foreground">
                كل ادعاء في الإجابة مرتبط بدليل واحد أو أكثر. اضغط على الأرقام
                <span className="citation-marker mx-1">1</span>
                في الإجابة للانتقال إلى الدليل المقابل.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="policy">
            <AccordionTrigger className="text-sm font-semibold">
              5. السياسة والتحليل
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">نوع السؤال:</span>{' '}
                  {getQuestionTypeLabel(result.policy.questionType)}
                </p>
                <p>
                  <span className="font-semibold">مستوى المحتوى:</span>{' '}
                  {getContentLevelLabel(result.policy.contentLevel)}
                </p>
                {policyNote && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {policyNote}
                  </p>
                )}
                {result.answer.abstain_reason && (
                  <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    سبب الامتناع: {result.answer.abstain_reason}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="answer">
            <AccordionTrigger className="text-sm font-semibold">
              6. الإجابة النهائية
            </AccordionTrigger>
            <AccordionContent>
              <p className="font-arabic text-sm leading-7 text-foreground/90">
                {result.answer.summary}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function IssueText({ issue }: { issue: ValidationIssue }) {
  const typeLabel =
    issue.type === 'unsupported_claim'
      ? 'ادعاء بلا دليل'
      : issue.type === 'missing_evidence'
        ? 'دليل مفقود'
        : issue.type === 'evidence_mismatch'
          ? 'تطابق غير دقيق'
          : issue.type
  return (
    <span>
      <span className="font-semibold">[{typeLabel}]</span> ادعاء رقم{' '}
      {issue.claimIndex + 1}: {issue.detail}
    </span>
  )
}
