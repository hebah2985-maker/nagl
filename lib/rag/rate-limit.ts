/**
 * Rate-limited LLM call wrapper.
 *
 * The Z.AI API returns HTTP 429 ("Too many requests") when we exceed the
 * per-key rate limit. This module wraps every LLM call with:
 *   1) A global concurrency limiter (max N in-flight LLM calls at once).
 *   2) A token-bucket-style minimum interval between calls.
 *   3) Exponential backoff retry on 429 / network errors (up to 5 attempts).
 *
 * The result: bursts of LLM calls (e.g. extractTags processing 30 chunks in
 * parallel batches of 5) no longer trip the rate limit.
 */

const MAX_CONCURRENCY = 2          // at most 2 LLM calls in flight
const MIN_INTERVAL_MS = 1200       // >=1.2s between successive call starts
const MAX_RETRIES = 5
const INITIAL_BACKOFF_MS = 1500
const MAX_BACKOFF_MS = 30000

let _activeCount = 0
let _lastStart = 0
const _queue: Array<() => void> = []

async function acquireSlot(): Promise<void> {
  // Wait for a concurrency slot
  while (_activeCount >= MAX_CONCURRENCY) {
    await new Promise<void>((resolve) => _queue.push(resolve))
  }
  _activeCount++
  // Enforce minimum interval between call starts
  const now = Date.now()
  const wait = Math.max(0, _lastStart + MIN_INTERVAL_MS - now)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  _lastStart = Date.now()
}

function releaseSlot(): void {
  _activeCount--
  if (_queue.length > 0) {
    const next = _queue.shift()!
    next()
  }
}

function isRetryableError(err: any): boolean {
  if (!err) return false
  const msg = String(err?.message || err)
  // 429 from Z.AI shows up in the error message text
  if (/429|Too many requests|too many requests/i.test(msg)) return true
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed/i.test(msg)) return true
  return false
}

function backoffMs(attempt: number): number {
  // Exponential with jitter. Cap at MAX_BACKOFF_MS.
  const base = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * Math.pow(2, attempt))
  // jitter: ±25%
  const jitter = base * (0.75 + Math.random() * 0.5)
  return Math.round(jitter)
}

/**
 * Run an LLM-producing async function with rate limiting + retry.
 * The fn should return the result of `zai.chat.completions.create(...)`.
 */
export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: any = null
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await acquireSlot()
    try {
      const result = await fn()
      releaseSlot()
      return result
    } catch (err: any) {
      releaseSlot()
      lastErr = err
      if (!isRetryableError(err) || attempt === MAX_RETRIES - 1) {
        throw err
      }
      const wait = backoffMs(attempt)
      console.warn(
        `[withRateLimit] attempt ${attempt + 1}/${MAX_RETRIES} failed (${String(err?.message || err).slice(0, 120)}...). Retrying in ${wait}ms`
      )
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  throw lastErr
}

/**
 * Map a sequence of items through an async fn with limited concurrency.
 * Use this instead of `Promise.all(items.map(fn))` for LLM calls.
 */
export async function mapWithRateLimit<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = 2
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  async function run() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(runners)
  return results
}
