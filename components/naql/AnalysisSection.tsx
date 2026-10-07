'use client'

import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  Info,
  Loader2,
  Microscope,
  Quote,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ANALYSIS_TOPICS, getSourceTypeLabel } from './labels'

const ANALYSIS_CONFIDENCE: Record<
  string,
  { label: string; className: string }
> = {
  high: {
    label: 'عالية',
    className:
      'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  medium: {
    label: 'متوسطة',
    className:
      'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  },
  low: {
    label: 'منخفضة',
    className:
      'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-200',
  },
}

interface RuntimeFinding {
  text: string
  chunkIds: Array<string | number>
}

interface RuntimeAnalysisResult {
  analysis: {
    topic: string
    summary: string
    findings: RuntimeFinding[]
    confidence: 'high' | 'medium' | 'low'
  }
  evidence: Array<{
    id: string
    sourceId: string
    sourceTitle: string
    author: string | null
    edition: string | null
    pageNumber: number
    chapter: string | null
    text: string
    score: number
  }>
  chunkIds: string[]
}

export function AnalysisSection() {
  const activeSourceId = useStore((s) => s.activeSourceId)
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const loading = useStore((s) => s.analysisLoading)
  const result = useStore((s) => s.analysisResult) as unknown as RuntimeAnalysisResult | null
  const analysisTopic = useStore((s) => s.analysisTopic)
  const runAnalysis = useStore((s) => s.runAnalysis)
  const setSection = useStore((s) => s.setSection)
  const loadLibrary = useStore((s) => s.loadLibrary)

  const [topic, setTopic] = useState(analysisTopic || 'tafsir_method')

  useEffect(() => {
    if (userSources.length === 0 && officialSources.length === 0) loadLibrary()
  }, [userSources.length, officialSources.length, loadLibrary])

  // Auto-select the first indexed user source if no source is selected.
  const goSource = useStore((s) => s.goSource)
  useEffect(() => {
    if (!activeSourceId) {
      const firstIndexed = userSources.find((s) => s.status === 'indexed')
      if (firstIndexed) {
        goSource(firstIndexed.id, 1)
      }
    }
  }, [activeSourceId, userSources, goSource])

  // Source from the store (may be undefined if library hasn't loaded yet).
  const sourceFromStore =
    userSources.find((s) => s.id === activeSourceId) ||
    officialSources.find((s) => s.id === activeSourceId)

  // Fallback: fetch source detail from the API if not in the store. This
  // handles the race condition where the user navigates to the analysis tab
  // before the library has finished loading, or after a page reload.
  const [sourceFromApi, setSourceFromApi] = useState<{
    id: string
    title: string
    author: string | null
    edition: string | null
    publisher: string | null
    sourceType: string
    status: string
    isOfficial: boolean
    pageCount: number
    chunkCount: number
  } | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)

  useEffect(() => {
    if (!activeSourceId || sourceFromStore) {
      // Defer the clear to avoid the react-hooks/set-state-in-effect rule.
      let active = true
      Promise.resolve().then(() => {
        if (active) setSourceFromApi(null)
      })
      return () => {
        active = false
      }
    }
    let active = true
    // Defer setState to avoid the react-hooks/set-state-in-effect rule.
    Promise.resolve().then(() => {
      if (active) setSourceLoading(true)
    })
    api.library
      .get(activeSourceId)
      .then((detail) => {
        if (!active) return
        setSourceFromApi({
          id: detail.id,
          title: detail.title,
          author: detail.author,
          edition: detail.edition,
          publisher: detail.publisher,
          sourceType: detail.sourceType,
          status: detail.status,
          isOfficial: detail.isOfficial,
          pageCount: detail.pageCount,
          chunkCount: detail.chunkCount,
        })
      })
      .catch(() => {
        if (!active) return
        setSourceFromApi(null)
      })
      .finally(() => {
        if (active) setSourceLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeSourceId, sourceFromStore])

  // Merge: prefer store data, fall back to API data.
  const source = sourceFromStore || sourceFromApi

  if (!activeSourceId) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        لم يتم اختيار مصدر لتحليله. ارجع إلى المكتبة واختر «تحليل» على مصدر مفهرس.
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setSection('library')}>
            <BookOpen className="size-4" />
            الذهاب إلى المكتبة
          </Button>
        </div>
      </Card>
    )
  }

  // If we have an activeSourceId but no source yet (library still loading +
  // API fetch in flight), show a loading state instead of the "not chosen"
  // message. This prevents the UI from flashing "لم يتم اختيار مصدر" when
  // the source actually exists but hasn't been resolved yet.
  if (!source) {
    if (sourceLoading) {
      return (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 size-6 animate-spin text-primary" />
          جاري تحميل بيانات المصدر...
        </Card>
      )
    }
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        <AlertCircle className="mx-auto mb-3 size-6 text-amber-500" />
        تعذّر العثور على المصدر. قد يكون قد حُذف أو لم يعد متاحًا.
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setSection('library')}>
            <BookOpen className="size-4" />
            الذهاب إلى المكتبة
          </Button>
        </div>
      </Card>
    )
  }

  function handleRun() {
    if (!activeSourceId) return
    void runAnalysis(activeSourceId, topic)
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 font-arabic text-2xl font-bold">
          <Microscope className="size-6 text-primary" />
          تحليل المصدر
        </h2>
        <p className="text-sm text-muted-foreground">
          تحليل منهجي مبني على المقاطع المسترجعة من المصدر. كل استنتاج مربوط بأدلته.
        </p>
      </header>

      {/* Source info card */}
      <Card>
        <CardHeader className="gap-3 border-b">
          <CardTitle className="line-clamp-2 text-lg">{source.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
            {source.author && <span>{source.author}</span>}
            {source.edition && (
              <>
                <span>•</span>
                <span>{source.edition}</span>
              </>
            )}
            {source.publisher && (
              <>
                <span>•</span>
                <span>{source.publisher}</span>
              </>
            )}
            <span>•</span>
            <Badge variant="secondary" className="text-xs">
              {getSourceTypeLabel(source.sourceType)}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            الموضوع الحالي:{' '}
            <span className="font-semibold text-foreground">
              {ANALYSIS_TOPICS.find((t) => t.id === topic)?.label}
            </span>
          </p>
        </CardContent>
      </Card>

      {/* Topic selector */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          اختر موضوع التحليل
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ANALYSIS_TOPICS.map((t) => {
            const active = topic === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopic(t.id)}
                className={
                  active
                    ? 'rounded-lg border-2 border-primary bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors'
                    : 'rounded-lg border bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground'
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleRun} disabled={loading || source.status !== 'indexed'}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                جاري التحليل...
              </>
            ) : (
              <>
                <Microscope className="size-4" />
                تشغيل التحليل
              </>
            )}
          </Button>
          {source.status !== 'indexed' && (
            <span className="text-xs text-muted-foreground">
              لا يمكن التحليل قبل فهرسة المصدر.
            </span>
          )}
        </div>
      </Card>

      {/* Reminder */}
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="text-primary" />
        <AlertDescription>
          كل نتيجة في التحليل مربوطة بالأدلة. لا يُعرض الاستنتاج على أنه نص
          المؤلف، ولا تُختلق نتائج بلا دليل مسترجع.
        </AlertDescription>
      </Alert>

      {/* Result */}
      {loading && <AnalysisSkeleton />}

      {!loading && result && (
        <div className="space-y-4">
          {/* Completion status banner */}
          <Alert className="border-emerald-400/50 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20">
            <CheckCircle className="text-emerald-600 dark:text-emerald-400" />
            <AlertDescription>
              <span className="font-semibold">تم التحليل.</span>{' '}
              {result.analysis.findings?.length || 0} استنتاج مبني على{' '}
              {result.evidence?.length || 0} دليل مسترجع من المصدر.
            </AlertDescription>
          </Alert>
          <AnalysisResultView
            result={result}
            sourceId={activeSourceId}
          />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function AnalysisSkeleton() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        جاري تحليل المصدر...
      </div>
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Result view                                                          */
/* ------------------------------------------------------------------ */

function AnalysisResultView({
  result,
  sourceId,
}: {
  result: RuntimeAnalysisResult
  sourceId: string
}) {
  const conf = ANALYSIS_CONFIDENCE[result.analysis.confidence] || ANALYSIS_CONFIDENCE.low

  return (
    <div className="space-y-5">
      {/* Summary */}
      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              ملخّص التحليل: {result.analysis.topic}
            </CardTitle>
            <Badge variant="outline" className={conf.className}>
              الثقة: {conf.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <p className="font-arabic text-base leading-8 text-foreground/90">
            {result.analysis.summary}
          </p>
        </CardContent>
      </Card>

      {/* Findings */}
      {result.analysis.findings && result.analysis.findings.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="size-4 text-primary" />
              الاستنتاجات ({result.analysis.findings.length})
            </CardTitle>
            <CardDescription>
              كل استنتاج يُفصل بصريًا عن النص الأصلي، ويرتبط بأدلته.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {result.analysis.findings.map((f, i) => (
              <FindingCard
                key={i}
                index={i + 1}
                finding={f}
                evidence={result.evidence}
                sourceId={sourceId}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          لا توجد استنتاجات كافية. جرّب موضوعًا آخر أو تأكد من فهرسة المصدر.
        </Card>
      )}

      {/* Evidence list */}
      {result.evidence.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Quote className="size-4 text-primary" />
              الأدلة المرتبطة ({result.evidence.length})
            </CardTitle>
            <CardDescription>
              مقاطع من المصدر استُخدمت في التحليل.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {result.evidence.map((ev, i) => (
              <div
                key={ev.id}
                id={`analysis-evidence-${i + 1}`}
                className="rounded-md border bg-card p-3 transition-all duration-300"
              >
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{ev.sourceTitle}</span>
                  <span>ص. {ev.pageNumber}</span>
                </div>
                <p className="font-classical line-clamp-4 leading-7 text-sm text-foreground/85">
                  {ev.text}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      openSourceAtChunk(sourceId, ev.pageNumber, ev.id)
                    }
                  >
                    <BookOpen className="size-3.5" />
                    فتح الصفحة
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Alert className="border-primary/30 bg-primary/5">
        <Info className="text-primary" />
        <AlertTitle>تذكير</AlertTitle>
        <AlertDescription>
          هذا التحليل استنتاج آلي مبني على المقاطع المسترجعة. راجع المصدر
          الأصلي للتأكد من النتائج.
        </AlertDescription>
      </Alert>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Finding card — separates analysis vs. quote                         */
/* ------------------------------------------------------------------ */

function FindingCard({
  index,
  finding,
  evidence,
  sourceId,
}: {
  index: number
  finding: RuntimeFinding
  evidence: RuntimeAnalysisResult['evidence']
  sourceId: string
}) {
  // Map chunkIds to evidence entries (chunkIds are 0-based evidence indexes OR string ids)
  const linkedEvidence = (finding.chunkIds || [])
    .map((cid) => {
      if (typeof cid === 'number') {
        return evidence[cid]
      }
      // string: try to find by chunk id
      return evidence.find((e) => e.id === cid)
    })
    .filter(Boolean) as RuntimeAnalysisResult['evidence']

  return (
    <div className="rounded-lg border">
      {/* Analysis (نص الاستنتاج) */}
      <div className="bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            {index}
          </span>
          الاستنتاج
        </div>
        <p className="font-arabic text-sm leading-7 text-foreground/90">
          {finding.text}
        </p>
        {linkedEvidence.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">الأدلة:</span>
            {linkedEvidence.map((ev, i) => (
              <button
                key={i}
                type="button"
                className="citation-marker"
                onClick={() => {
                  const el = document.getElementById(`analysis-evidence-${i + 1}`)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('ring-2', 'ring-accent', 'bg-accent/10')
                    setTimeout(
                      () =>
                        el.classList.remove('ring-2', 'ring-accent', 'bg-accent/10'),
                      1800,
                    )
                  }
                }}
                aria-label={`الدليل رقم ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Linked quotes (النص الأصلي) */}
      {linkedEvidence.length > 0 && (
        <div className="border-t bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <Quote className="size-3.5" />
            النص الأصلي
          </div>
          <div className="space-y-2">
            {linkedEvidence.map((ev, i) => (
              <div key={i} className="rounded-md border bg-background p-2.5">
                <p className="font-classical text-sm leading-7 text-foreground/80">
                  {ev.text}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>ص. {ev.pageNumber}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      openSourceAtChunk(sourceId, ev.pageNumber, ev.id)
                    }
                  >
                    <BookOpen className="size-3" />
                    فتح
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
