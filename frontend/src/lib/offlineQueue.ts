export type OfflineQueueItem = {
  id: string
  path: string
  method: string
  headers: Array<[string, string]>
  bodyText: string | null
  omitShopScope: boolean
  shopScoped: boolean
  createdAt: number
  attempts: number
  /** Login that queued it: replayed only for that user, never under someone else's session. */
  ownerEmail?: string | null
}

const OFFLINE_QUEUE_KEY = 'pos_offline_queue_v1'
/** Items the server rejected on replay (kept so an offline sale is never silently lost). */
const OFFLINE_FAILED_KEY = 'pos_offline_failed_v1'

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function readQueue(): OfflineQueueItem[] {
  if (!hasLocalStorage()) return []
  return safeJsonParse<OfflineQueueItem[]>(localStorage.getItem(OFFLINE_QUEUE_KEY), [])
}

function writeQueue(items: OfflineQueueItem[]) {
  if (!hasLocalStorage()) return
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getOfflineQueueSize(): number {
  return readQueue().length
}

export function enqueueOfflineRequest(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'attempts'>): string {
  const next: OfflineQueueItem = {
    id: makeId(),
    createdAt: Date.now(),
    attempts: 0,
    ...item,
  }
  const items = readQueue()
  items.push(next)
  writeQueue(items)
  return next.id
}

/** First queued item (optionally the first one matching `match`), in FIFO order. */
export function peekOfflineQueue(
  match?: (item: OfflineQueueItem) => boolean,
): OfflineQueueItem | null {
  const items = readQueue()
  if (!match) return items.length ? items[0] : null
  return items.find(match) ?? null
}

export function replaceOfflineQueueItem(next: OfflineQueueItem) {
  const items = readQueue()
  const i = items.findIndex((it) => it.id === next.id)
  if (i < 0) return
  items[i] = next
  writeQueue(items)
}

export function removeOfflineQueueItem(id: string) {
  const items = readQueue()
  const rest = items.filter((it) => it.id !== id)
  if (rest.length !== items.length) writeQueue(rest)
}

function withoutAuthHeader(headers: Array<[string, string]>): Array<[string, string]> {
  return headers.filter(([k]) => k.toLowerCase() !== 'authorization')
}

/** Move an item to the failed list instead of discarding it (credentials are never kept). */
export function moveOfflineQueueItemToFailed(id: string, status: number, detail: string) {
  const items = readQueue()
  const failed = items.find((it) => it.id === id)
  if (!failed || !hasLocalStorage()) return
  const prev = safeJsonParse<Array<OfflineQueueItem & { status: number; detail: string }>>(
    localStorage.getItem(OFFLINE_FAILED_KEY),
    [],
  )
  prev.push({ ...failed, headers: withoutAuthHeader(failed.headers), status, detail })
  localStorage.setItem(OFFLINE_FAILED_KEY, JSON.stringify(prev))
  writeQueue(items.filter((it) => it.id !== id))
}

/** Remove saved passwords (old Basic auth headers) from queued and failed items. */
export function scrubStoredOfflineCredentials() {
  if (!hasLocalStorage()) return
  try {
    const items = readQueue()
    if (items.some((it) => it.headers.some(([k]) => k.toLowerCase() === 'authorization'))) {
      writeQueue(items.map((it) => ({ ...it, headers: withoutAuthHeader(it.headers) })))
    }
    const failed = safeJsonParse<OfflineQueueItem[]>(localStorage.getItem(OFFLINE_FAILED_KEY), [])
    if (failed.some((it) => (it.headers ?? []).some(([k]) => k.toLowerCase() === 'authorization'))) {
      localStorage.setItem(
        OFFLINE_FAILED_KEY,
        JSON.stringify(failed.map((it) => ({ ...it, headers: withoutAuthHeader(it.headers ?? []) }))),
      )
    }
  } catch {
    /* ignore */
  }
}

export function getOfflineFailedCount(): number {
  if (!hasLocalStorage()) return 0
  return safeJsonParse<unknown[]>(localStorage.getItem(OFFLINE_FAILED_KEY), []).length
}
