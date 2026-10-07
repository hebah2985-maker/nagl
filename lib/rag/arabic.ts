/**
 * Arabic text utilities — normalization, tokenization, and matching.
 * Critical: keep RTL integrity, do NOT reverse strings.
 */

// Arabic diacritics (tashkeel) and tatweel for normalization
const TASHKEEL = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g

// Arabic-Indic vs Western digits map
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const WESTERN = '0123456789'

const ARABIC_INDIC_EXT = '۰۱۲۳۴۵۶۷۸۹'

export function stripTashkeel(s: string): string {
  return s.replace(TASHKEEL, '')
}

export function normalizeArabic(s: string): string {
  if (!s) return ''
  let r = s
  // Unify Alef forms
  r = r.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // آ أ إ ٱ -> ا
  // Unify Yaa
  r = r.replace(/\u0649/g, '\u064A') // ى -> ي
  // Unify Taa Marbuta -> Haa (loose)
  r = r.replace(/\u0629/g, '\u0629')
  // Remove tatweel
  r = r.replace(/\u0640/g, '')
  // Unify Hamza on letter
  r = r.replace(/\u0624/g, '\u0648') // ؤ -> و
  r = r.replace(/\u0626/g, '\u064A') // ئ -> ي
  // Normalize digits to Western
  for (let i = 0; i < 10; i++) {
    r = r.split(ARABIC_INDIC[i]).join(WESTERN[i])
    r = r.split(ARABIC_INDIC_EXT[i]).join(WESTERN[i])
  }
  // Collapse whitespace
  r = r.replace(/\s+/g, ' ').trim()
  return r
}

export function normalizeForSearch(s: string): string {
  // aggressive: strip tashkeel + normalize
  return normalizeArabic(stripTashkeel(s)).toLowerCase()
}

export function tokenize(s: string): string[] {
  const cleaned = stripTashkeel(s)
    .replace(/[^\u0600-\u06FF\u0750-\u077F\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.split(' ').filter((t) => t.length > 1)
}

// Arabic stop words (light list)
const STOPWORDS = new Set([
  'في', 'من', 'عن', 'على', 'إلى', 'الى', 'في', 'مع', 'هذا', 'هذه', 'ذلك',
  'التي', 'الذي', 'الذين', 'اللاتي', 'الذاتي', 'و', 'ف', 'ب', 'ل', 'أن',
  'ان', 'إن', 'ما', 'ماذا', 'كيف', 'أين', 'اين', 'متى', 'لماذا', 'هل',
  'قد', 'كل', 'بعض', 'غير', 'بين', 'هو', 'هي', 'هم', 'هن', 'كما', 'حيث',
  'عند', 'عنده', 'عندما', 'ثم', 'أو', 'او', 'أم', 'لا', 'لم', 'لن', 'لا',
  'قال', 'قوله', 'قالت', 'فقال', 'وقال', 'فإن', 'فان', 'لأن', 'لان',
  'يكون', 'تكون', 'كان', 'كانت', 'قد', 'لقد', 'هناك', 'هنا',
  'ال', 'أنه', 'انه', 'أنها', 'انها',
])

export function meaningfulTokens(s: string): string[] {
  return tokenize(s).filter((t) => !STOPWORDS.has(t) && t.length > 2)
}

// Highlight matched query terms inside a text segment
export function highlightTerms(text: string, query: string): string {
  const terms = meaningfulTokens(query)
  let result = text
  for (const term of terms) {
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${safe})`, 'g')
    result = result.replace(re, '<mark class="bg-accent/30 text-foreground rounded px-0.5">$1</mark>')
  }
  return result
}

// Page-aware chunking: splits a text block into chunks of roughly N chars,
// keeping page markers intact. Returns array of {text, startOffset, endOffset}
export function chunkTextByLength(
  text: string,
  chunkSize = 900,
  overlap = 120
): Array<{ text: string; start: number; end: number }> {
  const chunks: Array<{ text: string; start: number; end: number }> = []
  if (!text) return chunks
  const total = text.length
  let i = 0
  while (i < total) {
    let end = Math.min(i + chunkSize, total)
    // try to break on a space near the boundary
    if (end < total) {
      const nextSpace = text.indexOf(' ', end - 60)
      if (nextSpace > -1 && nextSpace < end + 80) end = nextSpace
    }
    chunks.push({ text: text.slice(i, end).trim(), start: i, end })
    if (end >= total) break
    i = end - overlap
    if (i < 0) i = 0
  }
  return chunks
}

// Extract page number heuristic from a chunk's text (rare, mostly from explicit markers)
export function looksLikePageMarker(line: string): boolean {
  return /^\s*(صفحة|الصفحة|ص|page|p)\s*\.?\s*\d+\s*$/i.test(line.trim())
}

// RTL safe truncate
export function truncateRTL(s: string, n: number): string {
  if (!s) return ''
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

// Clean raw extracted PDF text (removes form feeds, soft hyphens, weird spaces)
// ALSO converts Arabic presentation forms (isolated/initial/medial/final)
// back to their base Arabic letters so search and display work correctly.
// Many Arabic PDF fonts (e.g. Amiri) emit text in the U+FB50–U+FEFF range.
//
// Source: Unicode 13 Standard, Arabic Presentation Forms-B block (U+FE70–U+FEFF).
// Forms are NOT always contiguous (letters that cannot join from the left
// such as ALEF, DAL, RAA only have isolated+final forms). We use an explicit
// mapping table to avoid off-by-one errors.
const PF_B_MAP: Record<string, string> = {
  // Hamza & alef-hamza forms
  '\uFE80': '\u0621', // HAMZA isolated
  '\uFE81': '\u0622', '\uFE82': '\u0622', // ALEF MADDA isolated, final
  '\uFE83': '\u0623', '\uFE84': '\u0623', // ALEF HAMZA ABOVE isolated, final
  '\uFE85': '\u0624', '\uFE86': '\u0624', // WAW HAMZA isolated, final
  '\uFE87': '\u0625', '\uFE88': '\u0625', // ALEF HAMZA BELOW isolated, final
  '\uFE89': '\u0626', '\uFE8A': '\u0626', '\uFE8B': '\u0626', '\uFE8C': '\u0626', // YEH HAMZA 4 forms
  '\uFE8D': '\u0627', '\uFE8E': '\u0627', // ALEF isolated, final
  '\uFE8F': '\u0628', '\uFE90': '\u0628', '\uFE91': '\u0628', '\uFE92': '\u0628', // BEH 4 forms
  '\uFE93': '\u0629', '\uFE94': '\u0629', // TEH MARBUTA isolated, final
  '\uFE95': '\u062A', '\uFE96': '\u062A', '\uFE97': '\u062A', '\uFE98': '\u062A', // TEH 4 forms
  '\uFE99': '\u062B', '\uFE9A': '\u062B', '\uFE9B': '\u062B', '\uFE9C': '\u062B', // THEH 4 forms
  '\uFE9D': '\u062C', '\uFE9E': '\u062C', '\uFE9F': '\u062C', '\uFEA0': '\u062C', // JEEM 4 forms
  '\uFEA1': '\u062D', '\uFEA2': '\u062D', '\uFEA3': '\u062D', '\uFEA4': '\u062D', // HAH 4 forms
  '\uFEA5': '\u062E', '\uFEA6': '\u062E', '\uFEA7': '\u062E', '\uFEA8': '\u062E', // KHAH 4 forms
  '\uFEA9': '\u062F', '\uFEAA': '\u062F', // DAL isolated, final
  '\uFEAB': '\u0630', '\uFEAC': '\u0630', // THAL isolated, final
  '\uFEAD': '\u0631', '\uFEAE': '\u0631', // REH isolated, final
  '\uFEAF': '\u0632', '\uFEB0': '\u0632', // ZAIN isolated, final
  '\uFEB1': '\u0633', '\uFEB2': '\u0633', '\uFEB3': '\u0633', '\uFEB4': '\u0633', // SEEN 4 forms
  '\uFEB5': '\u0634', '\uFEB6': '\u0634', '\uFEB7': '\u0634', '\uFEB8': '\u0634', // SHEEN 4 forms
  '\uFEB9': '\u0635', '\uFEBA': '\u0635', '\uFEBB': '\u0635', '\uFEBC': '\u0635', // SAD 4 forms
  '\uFEBD': '\u0636', '\uFEBE': '\u0636', '\uFEBF': '\u0636', '\uFEC0': '\u0636', // DAD 4 forms
  '\uFEC1': '\u0637', '\uFEC2': '\u0637', '\uFEC3': '\u0637', '\uFEC4': '\u0637', // TAH 4 forms
  '\uFEC5': '\u0638', '\uFEC6': '\u0638', '\uFEC7': '\u0638', '\uFEC8': '\u0638', // ZAH 4 forms
  '\uFEC9': '\u0639', '\uFECA': '\u0639', '\uFECB': '\u0639', '\uFECC': '\u0639', // AIN 4 forms
  '\uFECD': '\u063A', '\uFECE': '\u063A', '\uFECF': '\u063A', '\uFED0': '\u063A', // GHAIN 4 forms
  '\uFED1': '\u0641', '\uFED2': '\u0641', '\uFED3': '\u0641', '\uFED4': '\u0641', // FEH 4 forms
  '\uFED5': '\u0642', '\uFED6': '\u0642', '\uFED7': '\u0642', '\uFED8': '\u0642', // QAF 4 forms
  '\uFED9': '\u0643', '\uFEDA': '\u0643', '\uFEDB': '\u0643', '\uFEDC': '\u0643', // KAF 4 forms
  '\uFEDD': '\u0644', '\uFEDE': '\u0644', '\uFEDF': '\u0644', '\uFEE0': '\u0644', // LAM 4 forms
  '\uFEE1': '\u0645', '\uFEE2': '\u0645', '\uFEE3': '\u0645', '\uFEE4': '\u0645', // MEEM 4 forms
  '\uFEE5': '\u0646', '\uFEE6': '\u0646', '\uFEE7': '\u0646', '\uFEE8': '\u0646', // NOON 4 forms
  '\uFEE9': '\u0647', '\uFEEA': '\u0647', '\uFEEB': '\u0647', '\uFEEC': '\u0647', // HEH 4 forms
  '\uFEED': '\u0648', '\uFEEE': '\u0648', // WAW isolated, final
  '\uFEEF': '\u0649', '\uFEF0': '\u0649', // ALEF MAKSURA isolated, final
  '\uFEF1': '\u064A', '\uFEF2': '\u064A', '\uFEF3': '\u064A', '\uFEF4': '\u064A', // YEH 4 forms
  // Ligatures & special
  '\uFEF5': '\u0644\u0622', '\uFEF6': '\u0644\u0622', // LAM ALEF MADDA isolated, final
  '\uFEF7': '\u0644\u0623', '\uFEF8': '\u0644\u0623', // LAM ALEF HAMZA ABOVE isolated, final
  '\uFEF9': '\u0644\u0625', '\uFEFA': '\u0644\u0625', // LAM ALEF HAMZA BELOW isolated, final
  '\uFEFB': '\u0644\u0627', '\uFEFC': '\u0644\u0627', // LAM ALEF isolated, final
  // Tatweel & shadda forms
  '\uFE7E': '\u0640', '\uFE7F': '\u0640', // TATWEEL
  '\uFE7C': '\u0651', '\uFE7D': '\u0651', // SHADDA isolated, medial
}
// Presentation Forms-A (U+FB50–U+FDFF) — Arabic ligatures commonly emitted
// by Arabic fonts (especially Amiri). Map to their canonical spellings.
const PF_A_MAP: Record<string, string> = {
  '\uFB50': '\u0627', '\uFB51': '\u0627', // ALEF WASLA
  '\uFB52': '\u0628', '\uFB53': '\u0628', '\uFB54': '\u0628', '\uFB55': '\u0628', // BEH WITH DOT BELOW
  '\uFB56': '\u0628', '\uFB57': '\u0628', '\uFB58': '\u0628', '\uFB59': '\u0628',
  '\uFB5E': '\u0628', '\uFB5F': '\u0628', '\uFB60': '\u0628', '\uFB61': '\u0628',
  '\uFB66': '\u062A', '\uFB67': '\u062A', '\uFB68': '\u062A', '\uFB69': '\u062A',
  '\uFB6A': '\u062A', '\uFB6B': '\u062A', '\uFB6C': '\u062A', '\uFB6D': '\u062A',
  '\uFB6E': '\u062B', '\uFB6F': '\u062B', '\uFB70': '\u062B', '\uFB71': '\u062B',
  '\uFB72': '\u062B', '\uFB73': '\u062B', '\uFB74': '\u062B', '\uFB75': '\u062B',
  '\uFB76': '\u062C', '\uFB77': '\u062C', '\uFB78': '\u062C', '\uFB79': '\u062C',
  '\uFB7A': '\u062C', '\uFB7B': '\u062C', '\uFB7C': '\u062C', '\uFB7D': '\u062C',
  '\uFB7E': '\u062D', '\uFB7F': '\u062D', '\uFB80': '\u062D', '\uFB81': '\u062D',
  '\uFB82': '\u062D', '\uFB83': '\u062D', '\uFB84': '\u062D', '\uFB85': '\u062D',
  '\uFB86': '\u062E', '\uFB87': '\u062E', '\uFB88': '\u062E', '\uFB89': '\u062E',
  '\uFB8A': '\u062E', '\uFB8B': '\u062E', '\uFB8C': '\u062E', '\uFB8D': '\u062E',
  '\uFB8E': '\u0643', '\uFB8F': '\u0643', '\uFB90': '\u0643', '\uFB91': '\u0643',
  '\uFB92': '\u0643', '\uFB93': '\u0643', '\uFB94': '\u0643', '\uFB95': '\u0643',
  '\uFB96': '\u0643', '\uFB97': '\u0643', '\uFB98': '\u0643', '\uFB99': '\u0643',
  '\uFB9A': '\u0643', '\uFB9B': '\u0643', '\uFB9C': '\u0643', '\uFB9D': '\u0643',
  '\uFB9E': '\u0644', '\uFB9F': '\u0644', '\uFBA0': '\u0644', '\uFBA1': '\u0644',
  '\uFBA2': '\u0644', '\uFBA3': '\u0644', '\uFBA4': '\u0644', '\uFBA5': '\u0644',
  '\uFBA6': '\u0645', '\uFBA7': '\u0645', '\uFBA8': '\u0645', '\uFBA9': '\u0645',
  '\uFBAA': '\u0645', '\uFBAB': '\u0645', '\uFBAC': '\u0645', '\uFBAD': '\u0645',
  '\uFBAE': '\u0646', '\uFBAF': '\u0646', '\uFBB0': '\u0646', '\uFBB1': '\u0646',
  '\uFBB2': '\u0646', '\uFBB3': '\u0646', '\uFBB4': '\u0646', '\uFBB5': '\u0646',
  '\uFBB6': '\u0647', '\uFBB7': '\u0647', '\uFBB8': '\u0647', '\uFBB9': '\u0647',
  '\uFBBA': '\u0647', '\uFBBB': '\u0647', '\uFBBC': '\u0647', '\uFBBD': '\u0647',
  '\uFBBE': '\u0647', '\uFBBF': '\u0647', '\uFBC0': '\u0647', '\uFBC1': '\u0647',
  '\uFBC2': '\u064A', '\uFBC3': '\u064A', '\uFBC4': '\u064A', '\uFBC5': '\u064A',
  '\uFBC6': '\u064A', '\uFBC7': '\u064A', '\uFBC8': '\u064A', '\uFBC9': '\u064A',
  '\uFBCA': '\u064A', '\uFBCB': '\u064A', '\uFBCC': '\u064A', '\uFBCD': '\u064A',
  '\uFBCE': '\u064A', '\uFBCF': '\u064A', '\uFBD0': '\u064A', '\uFBD1': '\u064A',
  // Allah ligature -> "الله"
  '\uFDF2': '\u0627\u0644\u0644\u0647',
  // SALLALLAHOU ALAYHI WASALLAM ligature
  '\uFDFA': '\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064A\u0647 \u0648\u0633\u0644\u0645',
  // JALLA JALALOUH ligature
  '\uFDFB': '\u062c\u0644 \u062c\u0644\u0627\u0644\u0647',
  // RASOUL & MOHAMMED ligatures
  '\uFDFA': '\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064A\u0647 \u0648\u0633\u0644\u0645',
}

function denormalizePresentationForms(s: string): string {
  if (!s) return s
  let r = ''
  for (const ch of s) {
    if (PF_B_MAP[ch]) r += PF_B_MAP[ch]
    else if (PF_A_MAP[ch]) r += PF_A_MAP[ch]
    else r += ch
  }
  return r
}

export function cleanExtractedText(s: string): string {
  if (!s) return ''
  // Convert any presentation forms to base Arabic letters FIRST
  let r = denormalizePresentationForms(s)
  r = r
    // Remove Unicode bidi control characters that pdftotext often emits
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\u00AD/g, '') // soft hyphen
    .replace(/\r\n/g, '\n')
    .replace(/\u000C/g, '\n') // form feed -> newline
    .replace(/\u00A0/g, ' ') // nbsp
    // Remove footnote-reference markers commonly emitted by hadith/tafsir PDFs:
    //   - Circled digits: ① ② ③ ... ⑳ and ❶ ❷ ... (used by many Arabic publishers
    //     to mark footnote anchors). Replace with a space so words don't merge.
    .replace(/[\u2460-\u2473\u24EB-\u24F4\u2780-\u2789\u278A-\u2793]/g, ' ')
    //   - Lone Arabic-Indic digit "٠" sitting between words (often an OCR
    //     artifact where a footnote marker was rendered as a bare 0). Only
    //     remove when surrounded by whitespace/punctuation so we don't strip
    //     it from legitimate numbers like "١٤٢٣هـ".
    .replace(/(^|[\s.,;:])0([\s.,;:])|([\s.,;:])0([\s.,;:]|$)/g, '$1$3')
    //   - Hadith reference numbers in double parens: ((715)) -> (715) kept
    //     but stripped of the inner double-bracket wrapping.
    .replace(/\(\((\d+)\)\)/g, '($1)')
    //   - Empty parens / empty brackets (footnote anchor with no text after
    //     PDF extraction dropped the actual footnote content).
    .replace(/\(\s*\)/g, ' ')
    .replace(/\[\s*\]/g, ' ')
    //   - Single-letter parenthetical markers like "(2*1)" "(9/*)" "(41@)"
    //     which are footnote keys with no readable content. Match when the
    //     inner text is short (< 6 chars) and contains no Arabic letters.
    .replace(/\(([^()]*?)\)/g, (m, inner) => {
      if (inner.length <= 5 && !/[\u0600-\u06FF]/.test(inner)) return ' '
      return m
    })
    //   - Standalone numbers in brackets [3] [4] when they look like footnote
    //     markers (short, digits-only). Keep brackets with longer Arabic text.
    .replace(/\[([^\]]*?)\]/g, (m, inner) => {
      if (inner.length <= 5 && /^\d+$/.test(inner.trim())) return ' '
      return m
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +| +$/gm, '')
    .trim()
  return r
}
