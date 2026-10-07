/**
 * Citation verification: compare user-submitted quote against the actual text
 * in a source. Returns match status, ratio, and a side-by-side diff.
 */
import * as fuzzball from 'fuzzball'
import { db } from '@/lib/db'
import { stripTashkeel, normalizeForSearch, tokenize } from './arabic'

export type CitationStatus = 'matched' | 'partial' | 'not_found'

export interface CitationDiffSegment {
  type: 'equal' | 'add' | 'remove' | 'change'
  text: string
}

export interface VerificationResult {
  status: CitationStatus
  matchRatio: number
  matchedChunkId: string | null
  matchedText: string | null
  matchedPage: number | null
  matchedSource: string | null
  differences: CitationDiffSegment[]
  isExactMatch: boolean
  note: string
}

// Naive word-level LCS diff between two Arabic texts (already normalized)
function diffWords(a: string, b: string): CitationDiffSegment[] {
  const aTokens = a.split(/\s+/).filter(Boolean)
  const bTokens = b.split(/\s+/).filter(Boolean)
  const m = aTokens.length
  const n = bTokens.length
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aTokens[i] === bTokens[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out: CitationDiffSegment[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (aTokens[i] === bTokens[j]) {
      out.push({ type: 'equal', text: aTokens[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'remove', text: aTokens[i] })
      i++
    } else {
      out.push({ type: 'add', text: bTokens[j] })
      j++
    }
  }
  while (i < m) {
    out.push({ type: 'remove', text: aTokens[i] })
    i++
  }
  while (j < n) {
    out.push({ type: 'add', text: bTokens[j] })
    j++
  }
  return out
}

// Find the best substring within a long text that matches the short query
function bestSubstring(
  query: string,
  longText: string
): { ratio: number; matched: string } {
  const q = normalizeForSearch(query)
  const t = normalizeForSearch(longText)
  if (!q || !t) return { ratio: 0, matched: '' }
  const qTokens = q.split(/\s+/).filter(Boolean)
  if (qTokens.length === 0) return { ratio: 0, matched: '' }
  const tTokens = t.split(/\s+/).filter(Boolean)

  const windowSize = qTokens.length + 8 // allow some padding
  let best = 0
  let bestSlice = ''
  for (let i = 0; i + windowSize <= tTokens.length; i++) {
    const slice = tTokens.slice(i, i + windowSize).join(' ')
    const r = fuzzball.ratio(q, slice, { forceAscii: false })
    if (r > best) {
      best = r
      bestSlice = slice
    }
  }
  // Edge: long text shorter than window
  if (!bestSlice) {
    const r = fuzzball.ratio(q, t, { forceAscii: false })
    return { ratio: r, matched: t }
  }
  return { ratio: best, matched: bestSlice }
}

export async function verifyCitation(
  quotedText: string,
  sourceId: string
): Promise<VerificationResult> {
  const cleanQuote = quotedText.trim()
  if (cleanQuote.length < 3) {
    return {
      status: 'not_found',
      matchRatio: 0,
      matchedChunkId: null,
      matchedText: null,
      matchedPage: null,
      matchedSource: null,
      differences: [],
      isExactMatch: false,
      note: 'النص المدخل قصير جدًا للتحقق منه بدقة.',
    }
  }

  // Pull chunks for the source
  const chunks = await db.chunk.findMany({
    where: { sourceId },
    include: { source: true },
  })
  if (chunks.length === 0) {
    return {
      status: 'not_found',
      matchRatio: 0,
      matchedChunkId: null,
      matchedText: null,
      matchedPage: null,
      matchedSource: null,
      differences: [],
      isExactMatch: false,
      note: 'لا توجد مقاطع مفهرسة لهذا المصدر بعد. ارفع وفهرس المصدر أولًا.',
    }
  }

  let bestRatio = 0
  let bestChunk: (typeof chunks)[number] | null = null
  let bestMatchedSlice = ''

  for (const c of chunks) {
    const text = c.originalText || ''
    const { ratio, matched } = bestSubstring(cleanQuote, text)
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestChunk = c
      bestMatchedSlice = matched
    }
  }

  if (!bestChunk) {
    return {
      status: 'not_found',
      matchRatio: 0,
      matchedChunkId: null,
      matchedText: null,
      matchedPage: null,
      matchedSource: null,
      differences: [],
      isExactMatch: false,
      note: 'لم يتم العثور على تطابق في المصدر المحدد.',
    }
  }

  // Compute diff between user input (normalized visually) and best matched slice
  // Note: for display purposes we keep the original Arabic text direction (RTL).
  const differences = diffWords(
    normalizeForSearch(cleanQuote),
    bestMatchedSlice
  )

  const isExact = bestRatio >= 98
  const status: CitationStatus = isExact
    ? 'matched'
    : bestRatio >= 60
      ? 'partial'
      : 'not_found'

  // Note text
  let note = ''
  if (isExact) {
    note = 'الاقتباس مطابق بالكامل للنص الأصلي.'
  } else if (status === 'partial') {
    note =
      'الاقتباس مطابق جزئيًا. راجع الفروقات أدناه؛ قد تكون هناك زيادة أو حذفًا أو اختلافًا في الصياغة.'
  } else {
    note =
      'لم يتم العثور على تطابق كافٍ. قد يكون الاقتباس من مكان آخر، أو منقّحًا، أو غير موجود في هذا المصدر تحديدًا.'
  }

  return {
    status,
    matchRatio: Math.round(bestRatio),
    matchedChunkId: bestChunk.id,
    matchedText: bestMatchedSlice,
    matchedPage: bestChunk.pageNumber,
    matchedSource: bestChunk.source?.title || null,
    differences,
    isExactMatch: isExact,
    note,
  }
}
