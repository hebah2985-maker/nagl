/**
 * Hybrid retrieval engine:
 *   1) Keyword retrieval: in-memory TF-style scoring on normalized Arabic text.
 *   2) Semantic rerank: LLM scores top-K candidates.
 * Returns ranked evidence with page + chapter info.
 */
import { db } from '@/lib/db'
import { normalizeForSearch, meaningfulTokens, stripTashkeel } from './arabic'
import { rerankChunks } from './llm'

export interface RawChunk {
  id: string
  sourceId: string
  sourceTitle: string
  author: string | null
  edition: string | null
  pageNumber: number
  chapter: string | null
  section: string | null
  text: string
  keywords: string[]
}

export interface ScoredChunk extends RawChunk {
  keywordScore: number
  semanticScore: number
  finalScore: number
}

// In-memory keyword search across chunks for given source IDs.
// Uses simple TF with query-term frequency + position bias.
export function keywordSearch(
  query: string,
  chunks: RawChunk[],
  maxResults = 20
): ScoredChunk[] {
  const qTokens = meaningfulTokens(query)
  if (qTokens.length === 0) return []
  const qNorm = qTokens.map(normalizeForSearch)

  const scored: ScoredChunk[] = []
  for (const c of chunks) {
    const haystack = normalizeForSearch(c.text)
    const hayKeywords = (c.keywords || []).map(normalizeForSearch)
    let tf = 0
    for (const q of qNorm) {
      // count occurrences in body
      let count = 0
      let idx = 0
      while ((idx = haystack.indexOf(q, idx)) >= 0) {
        count++
        idx += q.length
      }
      // count in explicit keywords (weight higher)
      for (const k of hayKeywords) {
        if (k.includes(q) || q.includes(k)) count += 2
      }
      tf += count
    }
    if (tf === 0) continue
    // Normalize by sqrt(length) for length fairness
    const lengthNorm = Math.sqrt(Math.max(1, c.text.length / 100))
    const keywordScore = tf / lengthNorm
    scored.push({ ...c, keywordScore, semanticScore: 0, finalScore: keywordScore })
  }
  scored.sort((a, b) => b.keywordScore - a.keywordScore)
  return scored.slice(0, maxResults)
}

export async function hybridSearch(
  query: string,
  sourceIds: string[],
  options: { mode?: 'keyword' | 'semantic' | 'hybrid'; topK?: number } = {}
): Promise<ScoredChunk[]> {
  const mode = options.mode || 'hybrid'
  const topK = options.topK || 8

  if (sourceIds.length === 0) return []

  // Load chunks from DB
  const dbChunks = await db.chunk.findMany({
    where: { sourceId: { in: sourceIds } },
    include: { source: true },
  })

  const chunks: RawChunk[] = dbChunks.map((c) => ({
    id: c.id,
    sourceId: c.sourceId,
    sourceTitle: c.source.title,
    author: c.source.author,
    edition: c.source.edition,
    pageNumber: c.pageNumber,
    chapter: c.chapter,
    section: c.section,
    text: c.originalText,
    keywords: (c.keywords || '').split(',').filter(Boolean),
  }))

  if (chunks.length === 0) return []

  // Step 1: keyword search
  let candidates = keywordSearch(query, chunks, 20)
  if (candidates.length === 0) {
    // Try a looser fallback: any chunk that contains at least one token (already done)
    // Try with raw token (no stopwords)
    const anyToken = meaningfulTokens(query)[0]
    if (anyToken) {
      const qn = normalizeForSearch(anyToken)
      candidates = chunks
        .filter((c) => normalizeForSearch(c.text).includes(qn))
        .slice(0, 20)
        .map((c) => ({ ...c, keywordScore: 1, semanticScore: 0, finalScore: 1 }))
    }
  }

  if (candidates.length === 0) return []

  if (mode === 'keyword') {
    return candidates.slice(0, topK)
  }

  // Step 2: semantic rerank (mode 'semantic' or 'hybrid')
  try {
    const rerankInput = candidates.map((c) => ({
      id: c.id,
      text: c.text,
      pageNumber: c.pageNumber,
      sourceTitle: c.sourceTitle,
    }))
    const reranked = await rerankChunks(query, rerankInput, topK)
    const map = new Map(reranked.map((r) => [r.id, r.score]))

    const out: ScoredChunk[] = []
    for (const c of candidates) {
      const semScore = map.get(c.id) ?? 0
      out.push({ ...c, semanticScore: semScore })
    }
    // Combine: hybrid = keyword * 0.4 + semantic * 0.6
    if (mode === 'hybrid') {
      for (const c of out) {
        const kw = c.keywordScore
        const sem = c.semanticScore
        c.finalScore = 0.4 * Math.min(1, kw / (out[0]?.keywordScore || 1)) + 0.6 * sem
      }
    } else {
      for (const c of out) c.finalScore = c.semanticScore
    }
    out.sort((a, b) => b.finalScore - a.finalScore)
    return out.slice(0, topK)
  } catch {
    return candidates.slice(0, topK)
  }
}

// Convenience: convert ScoredChunk into Evidence for LLM
export function toEvidence(chunk: ScoredChunk) {
  return {
    id: chunk.id,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    author: chunk.author,
    edition: chunk.edition,
    pageNumber: chunk.pageNumber,
    chapter: chunk.chapter,
    section: chunk.section,
    text: chunk.text,
    score: chunk.finalScore,
    keywords: chunk.keywords,
  }
}
