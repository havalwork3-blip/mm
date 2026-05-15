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
}

const OFFLINE_QUEUE_KEY = 'pos_offline_queue_v1'

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

export function peekOfflineQueue(): OfflineQueueItem | null {
  const items = readQueue()
  return items.length ? items[0] : null
}

export function replaceFirstQueueItem(next: OfflineQueueItem) {
  const items = readQueue()
  if (!items.length) return
  items[0] = next
  writeQueue(items)
}

export function shiftOfflineQueue() {
  const items = readQueue()
  if (!items.length) return
  items.shift()
  writeQueue(items)
}
