/**
 * Source Registry: official source definitions and policy mapping.
 * This is the curated registry of trusted Islamic sources. User uploads
 * are tagged with trustLevel="user_upload".
 */

import { db } from '@/lib/db'

export interface OfficialSourceDef {
  title: string
  author: string
  sourceType: 'quran' | 'hadith' | 'tafsir' | 'fiqh' | 'aqeedah' | 'language' | 'history' | 'general'
  organization?: string
  edition?: string
  publisher?: string
  year?: number
  trustLevel: 'official' | 'verified'
  allowedUsage: 'research' | 'reference_only'
  policyNotes?: string
}

// In-memory registry of recognized official sources. The MVP does not ship
// pre-loaded PDFs (those would be too large); instead, this registry defines
// metadata that user-uploaded files can be matched against, and serves as a
// catalog for the "official sources" view in the UI.
export const OFFICIAL_REGISTRY: OfficialSourceDef[] = [
  {
    title: 'القرآن الكريم',
    author: '—',
    sourceType: 'quran',
    organization: 'مصدر معتمد',
    edition: 'برواية حفص عن عاصم',
    trustLevel: 'official',
    allowedUsage: 'reference_only',
    policyNotes:
      'النص القرآني يجب أن يأتي من مصدر معتمد فقط. لا يجوز للنموذج إعادة كتابة الآية من ذاكرته.',
  },
  {
    title: 'جامع البيان عن تأويل آي القرآن (تفسير الطبري)',
    author: 'محمد بن جرير الطبري',
    sourceType: 'tafsir',
    organization: 'دار المعارف / دار الفكر',
    edition: 'تحقيق عبد الله بن عبد المحسن التركي',
    publisher: 'دار هجر للنشر والتوزيع',
    trustLevel: 'verified',
    allowedUsage: 'research',
    policyNotes:
      'تفسير معتمد. كل قول في التفسير يجب إسناده إلى المؤلف والصفحة. تحليل المنهج مبني على مقاطع مسترجعة فقط.',
  },
  {
    title: 'صحيح البخاري',
    author: 'محمد بن إسماعيل البخاري',
    sourceType: 'hadith',
    organization: 'مكتبة دار السلام',
    edition: 'طبعت بترقيم فتح الباري',
    trustLevel: 'verified',
    allowedUsage: 'research',
    policyNotes: 'يجب إظهار رقم الحديث ودرجته (صحيح).',
  },
  {
    title: 'صحيح مسلم',
    author: 'مسلم بن الحجاج النيسابوري',
    sourceType: 'hadith',
    organization: 'مكتبة دار السلام',
    edition: 'طبعت بترقيم محمد فؤاد عبد الباقي',
    trustLevel: 'verified',
    allowedUsage: 'research',
    policyNotes: 'يجب إظهار رقم الحديث ودرجته (صحيح).',
  },
  {
    title: 'معجم اللغة العربية المعاصرة',
    author: 'أحمد مختار عمر',
    sourceType: 'language',
    organization: 'عالم الكتب',
    trustLevel: 'verified',
    allowedUsage: 'reference_only',
    policyNotes: 'معجم معتمد لشرح المصطلحات. اعرض المعنى من المصدر مع اسم المعجم.',
  },
  {
    title: 'لسان العرب',
    author: 'محمد بن مكرم بن منظور',
    sourceType: 'language',
    organization: 'مصدر معتمد',
    trustLevel: 'verified',
    allowedUsage: 'reference_only',
    policyNotes: 'معجم لغوي تراثي معتمد. اعرض المادة والموضع.',
  },
  {
    title: 'الدرر السنية',
    author: 'مجموعة من المؤلفين',
    sourceType: 'general',
    organization: 'الدرر السنية - dorar.net',
    trustLevel: 'verified',
    allowedUsage: 'research',
    policyNotes: 'مصدر معتمد متعدد الفنون. إسناد كل معلومة ضروري.',
  },
  {
    title: 'المكتبة الشاملة',
    author: 'مكتبة شاملة',
    sourceType: 'general',
    organization: 'shamela.ws',
    trustLevel: 'verified',
    allowedUsage: 'research',
    policyNotes: 'مكتبة رقمية موسوعية. يُعتمد على النسخ الموسومة بـ "مطبوع".',
  },
]

// Seed the registry into the DB on first run so the UI can show the
// "official sources" panel. These are catalog entries (no file attached).
export async function seedOfficialCatalog() {
  for (const def of OFFICIAL_REGISTRY) {
    const existing = await db.source.findFirst({
      where: { title: def.title, isOfficial: true },
    })
    if (existing) continue
    await db.source.create({
      data: {
        title: def.title,
        author: def.author,
        sourceType: def.sourceType,
        organization: def.organization || null,
        edition: def.edition || null,
        publisher: def.publisher || null,
        year: def.year || null,
        language: 'ar',
        fileName: '—',
        filePath: '—',
        trustLevel: def.trustLevel,
        isOfficial: true,
        allowedUsage: def.allowedUsage,
        status: 'indexed',
        isTextExtracted: false,
        ocrRequired: false,
        pageCount: 0,
        chunkCount: 0,
      },
    })
  }
}

// Source-type display names (Arabic)
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  quran: 'القرآن الكريم',
  hadith: 'الحديث',
  tafsir: 'التفسير',
  fiqh: 'الفقه',
  aqeedah: 'العقيدة',
  language: 'اللغة',
  history: 'التاريخ',
  general: 'عام',
  methodology: 'منهج',
}

export const SOURCE_TYPE_ICONS: Record<string, string> = {
  quran: 'BookOpen',
  hadith: 'Scroll',
  tafsir: 'BookMarked',
  fiqh: 'Scale',
  aqeedah: 'Shield',
  language: 'Languages',
  history: 'Landmark',
  general: 'Library',
  methodology: 'Microscope',
}
