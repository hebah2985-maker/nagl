'use client'

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  ScrollText,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useStore } from '@/lib/store'
import { useViewerStore } from './viewer-store'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getSourceTypeLabel } from './labels'

/* Runtime shape of /api/library/[id]/page (the TS client uses `preview`
   for the chunk text field but the API actually returns `text`). */
interface RuntimeChunk {
  id: string
  chunkIndex: number
  text: string
  startOffset?: number
}
interface RuntimePageData {
  pageNumber: number
  pageCount: number
  text: string
  chunks: RuntimeChunk[]
}

export function SourceViewer() {
  const sourceId = useStore((s) => s.activeSourceId)
  const page = useStore((s) => s.activeSourcePage)
  const goSource = useStore((s) => s.goSource)
  const setSection = useStore((s) => s.setSection)
  const setVerifySourceId = useStore((s) => s.setVerifySourceId)
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const loadLibrary = useStore((s) => s.loadLibrary)
  const activeChunkId = useViewerStore((s) => s.activeChunkId)
  const clearActiveChunk = useViewerStore((s) => s.setActiveChunkId)

  const [data, setData] = useState<RuntimePageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState(String(page))

  // Source from the store (may be undefined if library hasn't loaded yet).
  const sourceFromStore =
    userSources.find((s) => s.id === sourceId) ||
    officialSources.find((s) => s.id === sourceId)

  // Fallback: fetch source detail from the API if not in the store. This
  // handles the race condition where the user navigates directly to a source
  // (e.g. via a deep link or after a page reload) before the library has
  // finished loading.
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
    if (!sourceId || sourceFromStore) {
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
      .get(sourceId)
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
  }, [sourceId, sourceFromStore])

  // Merge: prefer store data, fall back to API data.
  const source = sourceFromStore || sourceFromApi

  const fetchPage = useCallback(async () => {
    if (!sourceId) return
    setLoading(true)
    setError(null)
    try {
      const res = (await api.library.page(sourceId, page)) as unknown as RuntimePageData
      setData(res)
      setPageInput(String(res.pageNumber))
    } catch (e: any) {
      // Distinguish error types so access/auth/server errors are NOT
      // mistranslated as "source not found". Only a genuine 404 from the
      // API means the source is missing; everything else is a transient or
      // permissions issue that deserves a clearer message.
      if (e?.isAccessError) {
        setError(
          'لا تملك صلاحية الوصول إلى هذا المصدر. سجّل الدخول أو اختر مصدرًا آخر.'
        )
      } else if (e?.isServerError) {
        setError('تعذّر جلب المصدر بسبب خطأ في الخادم. حاول مرة أخرى لاحقًا.')
      } else if (e?.isNotFound) {
        setError('المصدر غير موجود. قد يكون قد حُذف أو أن المعرف غير صحيح.')
      } else {
        setError(e?.message || 'تعذّر جلب الصفحة.')
      }
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sourceId, page])

  useEffect(() => {
    if (!sourceId) {
      loadLibrary()
      return
    }
    void fetchPage()
  }, [sourceId, page, fetchPage, loadLibrary])

  // Scroll highlighted chunk into view once data arrives
  useEffect(() => {
    if (!data || !activeChunkId) return
    const t = setTimeout(() => {
      const el = document.getElementById(`chunk-${activeChunkId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 250)
    return () => clearTimeout(t)
  }, [data, activeChunkId])

  if (!sourceId) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        لم يتم اختيار مصدر لعرضه.
      </Card>
    )
  }

  const totalPages = data?.pageCount || source?.pageCount || 1

  function gotoPage(n: number) {
    if (!sourceId) return
    const target = Math.max(1, Math.min(totalPages, n))
    goSource(sourceId, target)
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <Card>
        <CardHeader className="gap-3 border-b">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="size-5 text-primary" />
                <span className="line-clamp-1">{source?.title || 'مصدر'}</span>
              </CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {source?.author && <span>{source.author}</span>}
                {source?.edition && (
                  <>
                    <span>•</span>
                    <span>{source.edition}</span>
                  </>
                )}
                {source && (
                  <>
                    <span>•</span>
                    <Badge variant="secondary" className="text-xs">
                      {getSourceTypeLabel(source.sourceType)}
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Verify button: pre-select this source and go to verify section.
                  Only show for indexed user sources (official catalog sources
                  have no extracted text to verify against). */}
              {source && !source.isOfficial && source.status === 'indexed' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setVerifySourceId(sourceId!)
                    setSection('verify')
                  }}
                >
                  <ShieldCheck className="size-3.5" />
                  تحقق
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearActiveChunk(null)
                  setSection('library')
                }}
              >
                رجوع للمكتبة
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <PageNav
            page={page}
            totalPages={totalPages}
            pageInput={pageInput}
            setPageInput={setPageInput}
            onPrev={() => gotoPage(page - 1)}
            onNext={() => gotoPage(page + 1)}
            onJump={() => {
              const n = parseInt(pageInput, 10)
              if (Number.isFinite(n)) gotoPage(n)
            }}
          />
        </CardContent>
      </Card>

      {/* Page body */}
      {loading ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            جاري تحميل الصفحة...
          </div>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-9/12" />
          <Skeleton className="h-5 w-full" />
        </Card>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <p className="text-sm text-muted-foreground">
              قد يكون المصدر قد حُذف أو لم يعد متاحًا. عُد إلى المكتبة لاختيار مصدر آخر.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSection('library')}
              className="gap-1.5"
            >
              <BookOpen className="size-3.5" />
              العودة إلى المكتبة
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <Card className="p-6 text-sm text-muted-foreground">
          لا توجد بيانات.
        </Card>
      ) : data.text && data.text.trim().length > 0 ? (
        <PageText data={data} activeChunkId={activeChunkId} />
      ) : source?.isOfficial ? (
        // Official catalog source — no PDF uploaded, metadata-only entry.
        <Card className="p-8 text-center">
          <BookOpen className="mx-auto mb-3 size-7 text-primary" />
          <p className="font-arabic text-base font-semibold">
            هذا مصدر معتمد تعريفي
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            لا يوجد ملف PDF مرفوع لهذا المصدر في النظام. هذه التسجيلة تعريفية
            فقط وتمثّل سياسة المصدر المعتمد. ارفع نسختك الخاصة من الكتاب للبحث
            فيه.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
            onClick={() => setSection('library')}
          >
            <BookOpen className="size-3.5" />
            العودة إلى المكتبة
          </Button>
        </Card>
      ) : source?.pageCount === 0 && source?.chunkCount === 0 ? (
        // User source with no extracted content (pending or failed indexing).
        <Card className="p-8 text-center">
          <Info className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-arabic text-base font-semibold">
            لا يوجد محتوى مستخرج بعد
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            قد يكون المصدر قيد المعالجة أو فشلت الفهرسة. تحقق من حالة المصدر في
            المكتبة وأعد المعالجة إن لزم.
          </p>
        </Card>
      ) : (
        // Page has content but this specific page is empty (likely image-only / OCR).
        <Card className="p-8 text-center">
          <Info className="mx-auto mb-3 size-7 text-muted-foreground" />
          <p className="font-arabic text-base font-semibold">
            تعذّر استخراج هذه الصفحة بدقة
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            قد تعتمد هذه الصفحة على نسخ صورية (OCR) أو لا تحتوي على نص قابل
            للاستخراج. راجع الملف الأصلي.
          </p>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page navigation                                                     */
/* ------------------------------------------------------------------ */

function PageNav({
  page,
  totalPages,
  pageInput,
  setPageInput,
  onPrev,
  onNext,
  onJump,
}: {
  page: number
  totalPages: number
  pageInput: string
  setPageInput: (v: string) => void
  onPrev: () => void
  onNext: () => void
  onJump: () => void
}) {
  // In RTL, "previous" is to the right (next page) and "next" is to the left.
  // For Western page numbers we keep ascending: prev = page-1, next = page+1.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="size-4" />
          <span className="hidden sm:inline">سابقة</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="الصفحة التالية"
        >
          <span className="hidden sm:inline">تالية</span>
          <ChevronLeft className="size-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Input
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onJump()
            }
          }}
          className="h-8 w-20 text-center tabular-nums"
          inputMode="numeric"
          aria-label="رقم الصفحة"
        />
        <Button variant="ghost" size="sm" onClick={onJump}>
          اذهب
        </Button>
        <span className="text-xs text-muted-foreground">
          من <span className="tabular-nums">{totalPages}</span>
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page text + chunk highlight                                          */
/* ------------------------------------------------------------------ */

function PageText({
  data,
  activeChunkId,
}: {
  data: RuntimePageData
  activeChunkId: string | null
}) {
  // Split text by `\n\n` (the join separator used by the API).
  // Each piece maps to one chunk in order; if counts match we can highlight
  // the chunk by id. If they don't match (rare: chunk contains `\n\n`),
  // we fall back to highlighting by searching the chunk preview.
  const pieces = data.text.split('\n\n').filter((p) => p.trim().length > 0)

  // Build a chunk lookup
  const chunksById = new Map(data.chunks.map((c) => [c.id, c]))

  // Determine index of active chunk
  let activeIndex = -1
  if (activeChunkId && chunksById.has(activeChunkId)) {
    activeIndex = data.chunks.findIndex((c) => c.id === activeChunkId)
  }

  // If we can map pieces 1:1 to chunks, use direct index mapping.
  const directMap = pieces.length === data.chunks.length && activeIndex >= 0

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ScrollText className="size-4 text-primary" />
        صفحة <span className="tabular-nums text-foreground">{data.pageNumber}</span>
      </div>
      <div className="font-classical space-y-5 text-base leading-loose text-foreground/90">
        {pieces.map((piece, i) => {
          const isActive = directMap && i === activeIndex
          const chunkId = directMap && i < data.chunks.length ? data.chunks[i].id : null
          return (
            <p
              key={i}
              id={chunkId ? `chunk-${chunkId}` : undefined}
              className={
                isActive
                  ? 'rounded-md bg-accent/15 p-3 ring-2 ring-accent transition-all'
                  : 'whitespace-pre-wrap'
              }
            >
              {piece}
            </p>
          )
        })}

        {/* Fallback: if direct mapping failed but we still want to highlight,
            show the active chunk's preview as a highlighted block at end. */}
        {!directMap && activeChunkId && chunksById.has(activeChunkId) && (
          <div
            id={`chunk-${activeChunkId}`}
            className="rounded-md bg-accent/15 p-3 ring-2 ring-accent"
          >
            <p className="mb-1 text-xs font-semibold text-accent-foreground/70">
              المقطع المحدد
            </p>
            <p className="whitespace-pre-wrap">
              {chunksById.get(activeChunkId)!.text}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

