/**
 * Frontend API client for Naql Muhaqqiq.
 * All calls use relative paths (Caddy gateway forwards XTransformPort=3000 implicitly).
 */

export interface SourceMeta {
  id: string
  title: string
  author: string | null
  sourceType: string
  organization: string | null
  edition: string | null
  publisher: string | null
  year: number | null
  language: string
  fileName: string
  pageCount: number
  chunkCount: number
  status: 'pending' | 'processing' | 'indexed' | 'failed'
  isTextExtracted: boolean
  ocrRequired: boolean
  extractionError: string | null
  trustLevel: string
  isOfficial: boolean
  allowedUsage: string
  createdAt: string
}

export interface LibraryResponse {
  user: SourceMeta[]
  official: SourceMeta[]
}

export interface ChunkPreview {
  id: string
  pageNumber: number
  chapter: string | null
  section: string | null
  chunkIndex: number
  preview: string
}

export interface SourceDetail extends SourceMeta {
  sampleChunks: ChunkPreview[]
}

export interface Evidence {
  id: string
  sourceId: string
  sourceTitle: string
  author: string | null
  edition: string | null
  pageNumber: number
  chapter: string | null
  section: string | null
  text: string
  score: number
  keywords?: string[]
}

export interface RagAnswer {
  summary: string
  claims: Array<{ text: string; evidence: number[] }>
  quotes: Array<{ text: string; evidence_index: number }>
  confidence: 'high' | 'medium' | 'low' | 'insufficient'
  abstain: boolean
  abstain_reason: string | null
  level: 'A' | 'B' | 'C' | 'D'
  notes: string
}

export interface ValidationIssue {
  type: 'unsupported_claim' | 'missing_evidence' | 'evidence_mismatch'
  claimIndex: number
  detail: string
}

export interface SearchResponse {
  answer: RagAnswer
  evidence: Evidence[]
  issues: ValidationIssue[]
  policy: {
    questionType: string
    contentLevel: 'A' | 'B' | 'C' | 'D'
    isPersonalFatwa: boolean
    policyNotes: string
  }
}

export interface PageData {
  pageNumber: number
  text: string
  chunks: Array<{ id: string; chunkIndex: number; preview: string }>
  pageCount: number
}

export type CitationStatus = 'matched' | 'partial' | 'not_found'

export interface DiffSegment {
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
  differences: DiffSegment[]
  isExactMatch: boolean
  note: string
}

export interface AnalysisResponse {
  analysis: {
    topic: string
    summary: string
    findings: Array<{ text: string; chunkIds: number[] }>
    confidence: 'high' | 'medium' | 'low'
  }
  evidence: Evidence[]
  chunkIds: string[]
}

export interface StatsResponse {
  sources: number
  userSources: number
  officialSources: number
  chunks: number
  searches: number
  citations: number
  verifiedMatched: number
  verifiedPartial: number
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    let serverMsg: string | null = null
    try {
      const j = await res.json()
      serverMsg = j.error || j.message || null
      msg = serverMsg || msg
    } catch {}
    const err = new Error(msg) as Error & {
      status?: number
      serverMessage?: string
      isNotFound?: boolean
      isAccessError?: boolean
      isServerError?: boolean
    }
    err.status = res.status
    err.serverMessage = serverMsg || undefined
    // 404 = genuinely not found in DB
    err.isNotFound = res.status === 404
    // 401/403 = access/auth error (NOT a "not found" — must not be
    // mistranslated as a missing source)
    err.isAccessError = res.status === 401 || res.status === 403
    // 5xx = server error (also not a "not found")
    err.isServerError = res.status >= 500
    throw err
  }
  return res.json() as Promise<T>
}

export const api = {
  library: {
    list: () => http<LibraryResponse>('/api/library'),
    get: (id: string) => http<SourceDetail>(`/api/library/${id}`),
    upload: (file: File, meta: { title?: string; author?: string; sourceType?: string; edition?: string }) => {
      const fd = new FormData()
      fd.append('file', file)
      if (meta.title) fd.append('title', meta.title)
      if (meta.author) fd.append('author', meta.author)
      if (meta.sourceType) fd.append('sourceType', meta.sourceType)
      if (meta.edition) fd.append('edition', meta.edition)
      return http<{ sourceId: string }>('/api/library', { method: 'POST', body: fd })
    },
    process: (id: string) =>
      http<{ status: string; pageCount: number; chunkCount: number; needsOCR?: boolean }>(
        `/api/library/${id}/process`,
        { method: 'POST' }
      ),
    delete: (id: string) => http<{ ok: boolean }>(`/api/library/${id}`, { method: 'DELETE' }),
    page: (id: string, page: number) =>
      http<PageData>(`/api/library/${id}/page?page=${page}`),
  },
  search: (body: { question: string; sourceIds: string[]; mode?: string; scopeMode?: string }) =>
    http<SearchResponse>('/api/search', { method: 'POST', body: JSON.stringify(body) }),
  verify: (body: { quotedText: string; sourceId: string }) =>
    http<VerificationResult>('/api/verify', { method: 'POST', body: JSON.stringify(body) }),
  analyze: (body: { sourceId: string; topic: string }) =>
    http<AnalysisResponse>('/api/analyze', { method: 'POST', body: JSON.stringify(body) }),
  stats: () => http<StatsResponse>('/api/stats'),
}
