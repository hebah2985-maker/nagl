/**
 * Server-side logging for missing-source responses.
 *
 * Centralizes the "source not found" log line so we can grep the dev/prod
 * logs for regressions (e.g. a deleted source still being referenced by
 * a stale URL, or a broken import/migration that left orphan IDs).
 *
 * Logs are written to stdout via console.warn so they appear in dev.log
 * (Next.js dev server) and in the production log aggregator.
 */

export interface MissingSourceContext {
  route: string
  sourceId: string
  reason?: 'not_found' | 'invalid_id' | 'lookup_error'
  detail?: string
}

export function logMissingSource(ctx: MissingSourceContext): void {
  const ts = new Date().toISOString()
  const line =
    `[missing-source] ${ts} route=${ctx.route} ` +
    `sourceId=${ctx.sourceId || '(empty)'} ` +
    `reason=${ctx.reason || 'not_found'}` +
    (ctx.detail ? ` detail=${ctx.detail}` : '')
  console.warn(line)
}

/**
 * Log a search that returned zero results — useful for catching indexing
 * regressions (e.g. a source marked "indexed" but with 0 chunks).
 */
export function logEmptySearch(ctx: {
  route: string
  question: string
  sourceIds: string[]
  chunkCount: number
}): void {
  const ts = new Date().toISOString()
  const line =
    `[empty-search] ${ts} route=${ctx.route} ` +
    `question=${ctx.question.slice(0, 80)} ` +
    `sources=[${ctx.sourceIds.join(',')}] ` +
    `chunks_found=${ctx.chunkCount}`
  console.warn(line)
}
