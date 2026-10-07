/**
 * Tiny separate store for the source viewer chunk-highlight state.
 *
 * The main Zustand store (src/lib/store.ts) cannot be modified per task
 * constraints, but SearchSection needs to tell SourceViewer which chunk to
 * highlight when the user clicks an evidence card. This lightweight store
 * holds that single piece of state.
 */
import { create } from 'zustand'

interface ViewerState {
  /** The chunk id SourceViewer should highlight after opening. */
  activeChunkId: string | null
  setActiveChunkId: (id: string | null) => void
}

export const useViewerStore = create<ViewerState>((set) => ({
  activeChunkId: null,
  setActiveChunkId: (id) => set({ activeChunkId: id }),
}))

/**
 * Open the source viewer at a specific page and tell it to highlight a chunk.
 * Resolves the main store lazily so we don't create a circular import.
 */
export function openSourceAtChunk(
  sourceId: string,
  page: number,
  chunkId: string | null,
) {
  // Lazy import keeps the module load graph clean.
  void import('@/lib/store').then(({ useStore }) => {
    useStore.getState().goSource(sourceId, page)
    useViewerStore.getState().setActiveChunkId(chunkId)
  })
}
