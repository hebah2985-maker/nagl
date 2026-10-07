'use client'

import {
  BookOpen,
  FileText,
  Info,
  Loader2,
  Microscope,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, type SourceMeta } from '@/lib/api'
import { useStore } from '@/lib/store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { getSourceTypeLabel, getStatusInfo } from './labels'

type SourceTypeOption =
  | 'tafsir'
  | 'hadith'
  | 'fiqh'
  | 'aqeedah'
  | 'language'
  | 'history'
  | 'general'

const SOURCE_TYPES: Array<{ value: SourceTypeOption; label: string }> = [
  { value: 'tafsir', label: 'تفسير' },
  { value: 'hadith', label: 'حديث' },
  { value: 'fiqh', label: 'فقه' },
  { value: 'aqeedah', label: 'عقيدة' },
  { value: 'language', label: 'لغة' },
  { value: 'history', label: 'تاريخ' },
  { value: 'general', label: 'عام' },
]

interface UploadState {
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'failed'
  progress: number
  message: string
  sourceId: string | null
}

const INITIAL_UPLOAD: UploadState = {
  status: 'idle',
  progress: 0,
  message: '',
  sourceId: null,
}

export function LibrarySection() {
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const libraryLoading = useStore((s) => s.libraryLoading)
  const loadLibrary = useStore((s) => s.loadLibrary)

  return (
    <div className="space-y-6 animate-fade-in-up">
      <header className="space-y-1">
        <h2 className="font-arabic text-2xl font-bold">المكتبة</h2>
        <p className="text-sm text-muted-foreground">
          ارفع مصادرك الخاصة، أو تصفّح المصادر المعتمدة الموثقة.
        </p>
      </header>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user">مكتبتي</TabsTrigger>
          <TabsTrigger value="official">مصادر معتمدة</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-6">
          <UploadCard onDone={loadLibrary} />

          {libraryLoading && userSources.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : userSources.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-muted-foreground">
                لا توجد مصادر مرفوعة بعد. ابدأ برفع ملف PDF من البطاقة أعلاه.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userSources.map((s) => (
                <SourceCard key={s.id} source={s} onDeleted={loadLibrary} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="official" className="space-y-6">
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="text-primary" />
            <AlertTitle className="font-arabic font-semibold">
              هذه مصادر معتمدة موثقة
            </AlertTitle>
            <AlertDescription>
              ارفع نسختك الخاصة للبحث فيها. هذه التسجيلات تعريفية فقط وتمثّل سياسة
              الاستخدام لكل مصدر.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {officialSources.map((s) => (
              <OfficialSourceCard key={s.id} source={s} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Upload card + processing pipeline                                   */
/* ------------------------------------------------------------------ */

function UploadCard({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [sourceType, setSourceType] = useState<SourceTypeOption>('general')
  const [edition, setEdition] = useState('')
  const [upload, setUpload] = useState<UploadState>(INITIAL_UPLOAD)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup any active polling when the dialog closes
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function resetForm() {
    setFile(null)
    setTitle('')
    setAuthor('')
    setSourceType('general')
    setEdition('')
    setUpload(INITIAL_UPLOAD)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null
    setFile(f)
    // prefill title from filename if user hasn't typed one
    if (f && !title) {
      const base = f.name.replace(/\.pdf$/i, '')
      setTitle(base)
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && /\.pdf$/i.test(f.name)) {
      setFile(f)
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ''))
    }
  }

  async function handleSubmit() {
    if (!file) return
    setUpload({
      status: 'uploading',
      progress: 10,
      message: 'جاري الرفع...',
      sourceId: null,
    })
    let sourceId: string | null = null
    try {
      const res = await api.library.upload(file, {
        title: title || undefined,
        author: author || undefined,
        sourceType,
        edition: edition || undefined,
      })
      sourceId = res.sourceId
      setUpload({
        status: 'processing',
        progress: 40,
        message: 'جاري معالجة المصدر...',
        sourceId,
      })
      // fire-and-forget process; we poll the source status
      void api.library.process(sourceId).catch(() => {
        // ignore — polling will surface the eventual state
      })
      startPolling(sourceId)
    } catch (e: any) {
      setUpload({
        status: 'failed',
        progress: 0,
        message: e?.message || 'تعذّر رفع الملف.',
        sourceId,
      })
    }
  }

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    let ticks = 0
    pollRef.current = setInterval(async () => {
      ticks++
      try {
        const detail = await api.library.get(id)
        setUpload((prev) => ({
          ...prev,
          progress: Math.min(95, 40 + ticks * 3),
          message: 'جاري معالجة المصدر...',
        }))
        if (detail.status === 'indexed') {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setUpload({
            status: 'done',
            progress: 100,
            message: 'تمت الفهرسة بنجاح.',
            sourceId: id,
          })
          onDone()
          setTimeout(() => {
            setOpen(false)
            resetForm()
          }, 800)
        } else if (detail.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          setUpload({
            status: 'failed',
            progress: 0,
            message:
              detail.extractionError ||
              'تعذّرت معالجة المصدر. تأكد من أن ملف PDF قابل للاستخراج.',
            sourceId: id,
          })
        }
      } catch {
        // keep polling; network blips shouldn't abort
      }
      // hard stop after ~5 min
      if (ticks > 100) {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
        setUpload((prev) => ({
          ...prev,
          status: 'failed',
          message: 'انتهت مهلة المعالجة. حاول مرة أخرى لاحقًا.',
        }))
      }
    }, 3000)
  }

  const isWorking = upload.status === 'uploading' || upload.status === 'processing'

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="size-5 text-primary" />
          رفع مصدر جديد
        </CardTitle>
        <CardDescription>
          ارفع ملف PDF لمصدر علمي. سيتم استخراج النص وفهرسته تلقائيًا.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (!isWorking) {
              setOpen(o)
              if (!o) resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Upload className="size-4" />
              ارفع ملف PDF
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>رفع مصدر جديد</DialogTitle>
              <DialogDescription>
                املأ بيانات المصدر. تُستخدم البيانات في الفهرسة والسياسة.
              </DialogDescription>
            </DialogHeader>

            {upload.status === 'idle' && (
              <div className="space-y-4">
                {/* Dropzone */}
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <Upload className="size-6 text-muted-foreground" />
                  {file ? (
                    <span className="text-sm font-medium text-foreground">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      اسحب ملف PDF هنا أو انقر للاختيار
                    </span>
                  )}
                </label>

                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="up-title">عنوان المصدر</Label>
                    <Input
                      id="up-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="مثال: جامع البيان عن تأويل آي القرآن"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="up-author">المؤلف</Label>
                    <Input
                      id="up-author"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="مثال: محمد بن جرير الطبري"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="up-type">نوع المصدر</Label>
                      <Select
                        value={sourceType}
                        onValueChange={(v) => setSourceType(v as SourceTypeOption)}
                      >
                        <SelectTrigger id="up-type" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="up-edition">الطبعة / التحقيق</Label>
                      <Input
                        id="up-edition"
                        value={edition}
                        onChange={(e) => setEdition(e.target.value)}
                        placeholder="مثال: تحقيق ...، دار ..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isWorking && (
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-3 text-sm">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="font-medium">{upload.message}</span>
                </div>
                <Progress value={upload.progress} />
                <p className="text-xs text-muted-foreground">
                  قد تستغرق المعالجة 30–90 ثانية للملفات الكبيرة. يمكنك إغلاق
                  النافذة لاحقًا وسيستمر العمل في الخلفية.
                </p>
              </div>
            )}

            {upload.status === 'done' && (
              <Alert className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                <Info className="text-emerald-600" />
                <AlertTitle>تمت الفهرسة بنجاح</AlertTitle>
                <AlertDescription>
                  يمكنك الآن البحث في هذا المصدر أو تحليله.
                </AlertDescription>
              </Alert>
            )}

            {upload.status === 'failed' && (
              <Alert variant="destructive">
                <AlertTitle>تعذّرت المعالجة</AlertTitle>
                <AlertDescription>{upload.message}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!isWorking) {
                    setOpen(false)
                    resetForm()
                  }
                }}
                disabled={isWorking}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!file || isWorking}
              >
                {isWorking ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    جاري الرفع...
                  </>
                ) : (
                  'رفع وفهرسة'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* User source card                                                    */
/* ------------------------------------------------------------------ */

function SourceCard({
  source,
  onDeleted,
}: {
  source: SourceMeta
  onDeleted: () => void
}) {
  const goSource = useStore((s) => s.goSource)
  const setSection = useStore((s) => s.setSection)
  const selectOnlySource = useStore((s) => s.selectOnlySource)
  const setVerifySourceId = useStore((s) => s.setVerifySourceId)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const status = getStatusInfo(source.status)

  function handleAnalyze() {
    // Set active source id, then switch to analysis section
    goSource(source.id, 1)
    setSection('analysis')
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.library.delete(source.id)
      onDeleted()
    } catch (e: any) {
      console.error('delete failed', e)
    } finally {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <Card className="gap-4 p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-arabic text-base font-semibold leading-snug">
              {source.title}
            </h3>
            {source.author && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {source.author}
              </p>
            )}
          </div>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {getSourceTypeLabel(source.sourceType)}
          </Badge>
          {source.edition && (
            <Badge variant="outline" className="text-xs">
              {source.edition}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" />
            {source.pageCount} صفحة
          </span>
          <span>•</span>
          <span>{source.chunkCount} مقطع</span>
        </div>

        {source.status === 'failed' && source.extractionError && (
          <Alert variant="destructive" className="text-xs">
            <AlertDescription>{source.extractionError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          size="sm"
          variant="default"
          onClick={() => goSource(source.id, 1)}
          disabled={source.status !== 'indexed'}
        >
          <BookOpen className="size-3.5" />
          فتح
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            selectOnlySource(source.id)
            setSection('search')
          }}
          disabled={source.status !== 'indexed'}
        >
          <Search className="size-3.5" />
          بحث
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAnalyze}
          disabled={source.status !== 'indexed'}
        >
          <Microscope className="size-3.5" />
          تحليل
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setVerifySourceId(source.id)
            setSection('verify')
          }}
          disabled={source.status !== 'indexed'}
        >
          <ShieldCheck className="size-3.5" />
          تحقق
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-3.5" />
          حذف
        </Button>
      </div>

      <Dialog
        open={confirmingDelete}
        onOpenChange={(o) => !deleting && setConfirmingDelete(o)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              سيتم حذف المصدر «{source.title}» وكل مقاطعه نهائيًا.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                'حذف نهائي'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Official source card                                                */
/* ------------------------------------------------------------------ */

function OfficialSourceCard({ source }: { source: SourceMeta }) {
  // The API does not return policyNotes for official sources; build a
  // helpful description from the available metadata.
  const usageLabel =
    source.allowedUsage === 'research'
      ? 'مسموح للبحث والاقتباس مع الإسناد.'
      : source.allowedUsage === 'reference_only'
        ? 'للمرجعية فقط — لا يجوز اعتماده كمصدر اقتباس مباشر.'
        : 'مصدر معتمد موثق.'
  const trustLabel =
    source.trustLevel === 'official'
      ? 'مصدر رسمي معتمد'
      : source.trustLevel === 'verified'
        ? 'مصدر موثق'
        : 'مصدر معتمد'
  const note = `${trustLabel}. ${usageLabel}${
    source.organization ? ` — ${source.organization}` : ''
  }`

  return (
    <Card className="gap-3 p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-arabic text-base font-semibold leading-snug">
              {source.title}
            </h3>
            {source.author && source.author !== '—' && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {source.author}
              </p>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <Info className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs leading-5">{note}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-xs">
            {getSourceTypeLabel(source.sourceType)}
          </Badge>
          {source.organization && (
            <Badge variant="outline" className="text-xs">
              {source.organization}
            </Badge>
          )}
          {source.allowedUsage === 'research' ? (
            <Badge
              variant="outline"
              className="border-emerald-300 bg-emerald-50 text-emerald-700 text-xs dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              للبحث
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-700 text-xs dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            >
              للمرجعية فقط
            </Badge>
          )}
        </div>

        {source.edition && (
          <p className="text-xs text-muted-foreground">{source.edition}</p>
        )}
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Unused but exported for symmetry with search panel                  */
/* ------------------------------------------------------------------ */

export function SelectSourcesSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const userSources = useStore((s) => s.userSources)
  const officialSources = useStore((s) => s.officialSources)
  const selectedIds = useStore((s) => s.selectedSourceIds)
  const toggle = useStore((s) => s.toggleSource)
  const clearAll = useStore((s) => s.clearSelectedSources)

  const all = [...userSources, ...officialSources.filter((s) => s.chunkCount > 0)]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>اختيار المصادر</SheetTitle>
          <SheetDescription>
            حدد المصادر التي يُجري فيها البحث. لا تظهر المصادر غير المفهرسة.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4 scrollbar-thin">
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
          {all.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لا توجد مصادر مفهرسة بعد.
            </p>
          ) : (
            all.map((s) => {
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
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
