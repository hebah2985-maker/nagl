/**
 * Zustand store for the Naql Muhaqqiq SPA. Holds navigation state, library cache,
 * active source selection, and last search/verify results.
 */
import { create } from 'zustand'
import type { Evidence, RagAnswer, SourceMeta, VerificationResult, ValidationIssue, SearchResponse, StatsResponse } from './api'

export type Section = 'home' | 'library' | 'search' | 'verify' | 'source' | 'analysis'

export interface SelectedEvidence extends Evidence {
  index: number
}

interface StoreState {
  // Navigation
  section: Section
  setSection: (s: Section) => void
  goSource: (sourceId: string, page?: number) => void
  activeSourceId: string | null
  activeSourcePage: number

  // Library
  userSources: SourceMeta[]
  officialSources: SourceMeta[]
  loadLibrary: () => Promise<void>
  libraryLoading: boolean
  refreshTick: number
  bumpRefresh: () => void

  // Search
  selectedSourceIds: string[]
  toggleSource: (id: string) => void
  selectOnlySource: (id: string) => void
  clearSelectedSources: () => void
  searchMode: 'keyword' | 'semantic' | 'hybrid'
  setSearchMode: (m: 'keyword' | 'semantic' | 'hybrid') => void
  scopeMode: 'this_book' | 'user_library' | 'official'
  setScopeMode: (s: 'this_book' | 'user_library' | 'official') => void

  lastQuestion: string
  setLastQuestion: (q: string) => void
  searchLoading: boolean
  searchResult: SearchResponse | null
  searchError: string | null
  runSearch: (q: string) => Promise<void>

  // Verify
  verifyLoading: boolean
  verifyResult: VerificationResult | null
  verifySourceId: string | null
  setVerifySourceId: (id: string) => void
  runVerify: (text: string, sourceId: string) => Promise<void>

  // Analysis
  analysisLoading: boolean
  analysisResult: Awaited<ReturnType<typeof import('./api').api.analyze>> | null
  analysisTopic: string
  runAnalysis: (sourceId: string, topic: string) => Promise<void>

  // Stats
  stats: StatsResponse | null
  loadStats: () => Promise<void>

  // Auth
  user: { id: string | null; email: string | null; name: string | null; role: string } | null
  authLoading: boolean
  authDialogOpen: boolean
  authDialogMode: 'login' | 'signup'
  setAuthDialogOpen: (open: boolean) => void
  setAuthDialogMode: (m: 'login' | 'signup') => void
  loadUser: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signUp: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ ok: boolean; error?: string }>
  signOut: () => Promise<void>
}

export const useStore = create<StoreState>((set, get) => ({
  section: 'home',
  setSection: (s) => set({ section: s }),
  goSource: (sourceId, page = 1) =>
    set({ section: 'source', activeSourceId: sourceId, activeSourcePage: page }),
  activeSourceId: null,
  activeSourcePage: 1,

  userSources: [],
  officialSources: [],
  loadLibrary: async () => {
    set({ libraryLoading: true })
    try {
      const { api } = await import('./api')
      const data = await api.library.list()
      set({ userSources: data.user, officialSources: data.official, libraryLoading: false })
    } catch (e: any) {
      set({ libraryLoading: false })
      console.error('library load failed', e)
    }
  },
  libraryLoading: false,
  refreshTick: 0,
  bumpRefresh: () => set((s) => ({ refreshTick: s.refreshTick + 1 })),

  selectedSourceIds: [],
  toggleSource: (id) =>
    set((s) => ({
      selectedSourceIds: s.selectedSourceIds.includes(id)
        ? s.selectedSourceIds.filter((x) => x !== id)
        : [...s.selectedSourceIds, id],
    })),
  selectOnlySource: (id) => set({ selectedSourceIds: [id], scopeMode: 'this_book' }),
  clearSelectedSources: () => set({ selectedSourceIds: [] }),
  searchMode: 'hybrid',
  setSearchMode: (m) => set({ searchMode: m }),
  scopeMode: 'user_library',
  setScopeMode: (s) => set({ scopeMode: s }),

  lastQuestion: '',
  setLastQuestion: (q) => set({ lastQuestion: q }),
  searchLoading: false,
  searchResult: null,
  searchError: null,
  runSearch: async (q) => {
    const state = get()
    if (!q.trim()) return
    if (state.selectedSourceIds.length === 0) {
      set({ searchError: 'حدّد مصدرًا واحدًا على الأقل للبحث.' })
      return
    }
    set({ searchLoading: true, searchError: null, lastQuestion: q })
    try {
      const { api } = await import('./api')
      const result = await api.search({
        question: q,
        sourceIds: state.selectedSourceIds,
        mode: state.searchMode,
        scopeMode: state.scopeMode,
      })
      set({ searchResult: result, searchLoading: false })
    } catch (e: any) {
      set({ searchError: e?.message || 'تعذّر تنفيذ البحث.', searchLoading: false })
    }
  },

  verifyLoading: false,
  verifyResult: null,
  verifySourceId: null,
  setVerifySourceId: (id) => set({ verifySourceId: id }),
  runVerify: async (text, sourceId) => {
    if (!sourceId) {
      set({ verifyResult: null })
      return
    }
    set({ verifyLoading: true })
    try {
      const { api } = await import('./api')
      const result = await api.verify({ quotedText: text, sourceId })
      set({ verifyResult: result, verifyLoading: false })
    } catch (e: any) {
      set({ verifyLoading: false })
      console.error('verify failed', e)
    }
  },

  analysisLoading: false,
  analysisResult: null,
  analysisTopic: 'methodology',
  runAnalysis: async (sourceId, topic) => {
    set({ analysisLoading: true })
    try {
      const { api } = await import('./api')
      const result = await api.analyze({ sourceId, topic })
      set({ analysisResult: result, analysisLoading: false, analysisTopic: topic })
    } catch (e: any) {
      set({ analysisLoading: false })
      console.error('analyze failed', e)
    }
  },

  stats: null,
  loadStats: async () => {
    try {
      const { api } = await import('./api')
      const stats = await api.stats()
      set({ stats })
    } catch {
      // ignore
    }
  },

  // Auth
  user: null,
  authLoading: false,
  authDialogOpen: false,
  authDialogMode: 'login',
  setAuthDialogOpen: (open) => set({ authDialogOpen: open }),
  setAuthDialogMode: (m) => set({ authDialogMode: m }),
  loadUser: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      const data = await res.json()
      set({ user: data.user || null })
    } catch {
      set({ user: null })
    }
  },
  signIn: async (email, password) => {
    set({ authLoading: true })
    try {
      // NextAuth credentials endpoint
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          email,
          password,
          csrfToken: '',
          json: 'true',
        }),
        credentials: 'same-origin',
      })
      // The credentials endpoint requires a csrf token; easier: use signIn from
      // next-auth/react which the AuthDialog calls directly. As a fallback we
      // fetch /api/auth/me after the dialog succeeds via next-auth.
      void res
      // Reload user
      await get().loadUser()
      set({ authLoading: false, authDialogOpen: false })
      return { ok: true }
    } catch (e: any) {
      set({ authLoading: false })
      return { ok: false, error: String(e?.message || e) }
    }
  },
  signUp: async (email, password, name) => {
    set({ authLoading: true })
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || '' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        set({ authLoading: false })
        return { ok: false, error: data.error || 'تعذّر إنشاء الحساب.' }
      }
      // After successful signup, the AuthDialog will call signIn via
      // next-auth/react. Here we just clear loading.
      set({ authLoading: false })
      return { ok: true }
    } catch (e: any) {
      set({ authLoading: false })
      return { ok: false, error: String(e?.message || e) }
    }
  },
  signOut: async () => {
    try {
      // Call next-auth signOut via fetch to clear the session cookie
      const csrfRes = await fetch('/api/auth/csrf', { credentials: 'same-origin' })
      const csrfJson = await csrfRes.json().catch(() => ({}))
      const csrfToken = csrfJson.csrfToken || ''
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ csrfToken }),
        credentials: 'same-origin',
      })
    } catch {
      // ignore — UI will still update
    }
    set({ user: null })
  },
}))
