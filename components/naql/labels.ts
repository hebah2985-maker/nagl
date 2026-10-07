/**
 * Shared Arabic label maps and helpers for the Naql Muhaqqiq SPA.
 */

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  quran: 'القرآن',
  hadith: 'الحديث',
  tafsir: 'التفسير',
  fiqh: 'الفقه',
  aqeedah: 'العقيدة',
  language: 'اللغة',
  history: 'التاريخ',
  general: 'عام',
  methodology: 'منهج',
}

export const SOURCE_TYPE_SHORT: Record<string, string> = {
  quran: 'قرآن',
  hadith: 'حديث',
  tafsir: 'تفسير',
  fiqh: 'فقه',
  aqeedah: 'عقيدة',
  language: 'لغة',
  history: 'تاريخ',
  general: 'عام',
  methodology: 'منهج',
}

export interface StatusInfo {
  label: string
  className: string
}

export const STATUS_INFO: Record<string, StatusInfo> = {
  pending: {
    label: 'معلّق',
    className:
      'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
  },
  processing: {
    label: 'قيد المعالجة',
    className:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  },
  indexed: {
    label: 'مفهرس',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  },
  failed: {
    label: 'فشل',
    className:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  },
}

export interface ConfidenceInfo {
  label: string
  className: string
}

export const CONFIDENCE_INFO: Record<string, ConfidenceInfo> = {
  high: {
    label: 'عالية',
    className:
      'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  },
  medium: {
    label: 'متوسطة',
    className:
      'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
  },
  low: {
    label: 'منخفضة',
    className:
      'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
  },
  insufficient: {
    label: 'غير كافية',
    className:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
  },
}

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  ayah: 'آية قرآنية',
  hadith: 'حديث شريف',
  tafsir: 'تفسير',
  fiqh: 'فقه',
  aqeedah: 'عقيدة',
  term: 'مصطلح',
  fatwa: 'فتوى شخصية',
  biography: 'ترجمة',
  history: 'تاريخ',
  methodology: 'منهج',
  general: 'عام',
}

export const CONTENT_LEVEL_LABELS: Record<string, string> = {
  A: 'A — مرجع مباشر',
  B: 'B — مرجع مع تأويل',
  C: 'C — مسائل خلاف',
  D: 'D — فتوى شخصية',
}

export const ANALYSIS_TOPICS: Array<{ id: string; label: string }> = [
  { id: 'tafsir_method', label: 'منهج التفسير' },
  { id: 'aqeedah', label: 'منهج العقيدة' },
  { id: 'israiliyyat', label: 'التعامل مع الإسرائيليات' },
  { id: 'istidlal_method', label: 'منهج الاستدلال' },
  { id: 'qiraat_method', label: 'التعامل مع القراءات' },
  { id: 'sources_used', label: 'المصادر المعتمدة' },
  { id: 'methodology', label: 'معلومات الكتاب' },
]

/** "ما لا يفعله النظام" — list of system prohibitions, reused across views. */
export const SYSTEM_PROHIBITIONS: string[] = [
  'لا يختلق آية قرآنية أو حديثًا أو اقتباسًا أو رقم صفحة أو مصدرًا.',
  'لا يقدم فتوى شخصية مستقلة، ويُحيل المسائل الشخصية إلى مختص.',
  'لا يستخدم معرفة النموذج الداخلية كمصدر؛ كل معلومة تُربط بمصدرها.',
  'إذا لم يجد دليلًا كافيًا يصرّح بذلك ولا يخمن.',
]

export function getSourceTypeLabel(t: string | null | undefined): string {
  if (!t) return 'عام'
  return SOURCE_TYPE_LABELS[t] || t
}

export function getSourceTypeShort(t: string | null | undefined): string {
  if (!t) return 'عام'
  return SOURCE_TYPE_SHORT[t] || t
}

export function getStatusInfo(s: string | null | undefined): StatusInfo {
  if (!s) return STATUS_INFO.pending
  return STATUS_INFO[s] || STATUS_INFO.pending
}

export function getConfidenceInfo(c: string | null | undefined): ConfidenceInfo {
  if (!c) return CONFIDENCE_INFO.insufficient
  return CONFIDENCE_INFO[c] || CONFIDENCE_INFO.insufficient
}

export function getQuestionTypeLabel(t: string | null | undefined): string {
  if (!t) return 'عام'
  return QUESTION_TYPE_LABELS[t] || t
}

export function getContentLevelLabel(l: string | null | undefined): string {
  if (!l) return '—'
  return CONTENT_LEVEL_LABELS[l] || l
}
