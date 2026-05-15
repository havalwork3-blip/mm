import {
  enqueueOfflineRequest,
  peekOfflineQueue,
  replaceFirstQueueItem,
  shiftOfflineQueue,
} from './offlineQueue'

/**
 * API origin for JSON and media. Order: `VITE_API_URL` → same host as the page on
 * port 8000 when the SPA is not opened via localhost (phone/LAN and `vite preview`).
 * In production builds on a real hostname, same-origin is used (reverse proxy on /api/).
 * Set `VITE_API_URL` to override (e.g. a separate API subdomain).
 */
export function getApiBase(): string {
  const env = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '')
  if (env) return env
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // Production build on a real hostname: same-origin (e.g. Nginx → Gunicorn on /api/).
      if (import.meta.env.PROD) return window.location.origin
      return `${protocol}//${hostname}:8000`
    }
  }
  return 'http://127.0.0.1:8000'
}

function isLocalApiBase(base: string): boolean {
  try {
    const host = new URL(`${base}/`).hostname
    return host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

/**
 * Django returns absolute media URLs using the request Host (often 127.0.0.1).
 * The SPA may use VITE_API_URL with a LAN hostname. <img> must load the same
 * origin the user reaches; rewrite /media/* to the configured API origin.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (url == null || url === '') return null
  const base = getApiBase()
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    try {
      parsed = new URL(url, `${base}/`)
    } catch {
      return url
    }
  }
  if (parsed.pathname.startsWith('/media/')) {
    const origin = new URL(`${base}/`).origin
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  return parsed.href
}

let basicUser: string | null = null
let basicPass: string | null = null
/** When set, appended as ?shop_id= for every request (superuser impersonation). */
let superuserShopId: string | null = null
let isFlushingOfflineQueue = false

const SESSION_AUTH_KEY = 'pos_session_auth'
/** When "1", superuser API calls omit ?shop_id= (global multi-tenant lists). */
const GLOBAL_VIEW_KEY = 'pos_global_view'
const OFFLINE_QUEUED_HINT =
  'No internet. Your change was saved locally and will sync automatically when connection is back.'
const NO_SHOP_SCOPE_DETAIL =
  'No shop scope: assign a shop to this user, pass shop_id, or include shop in the request body (superuser).'

function translateApiDetail(detail: string): string {
  if (detail !== NO_SHOP_SCOPE_DETAIL) return detail
  const lang = (typeof localStorage !== 'undefined' ? localStorage.getItem('ui_lang') : null) || 'ku'
  if (lang === 'ar') {
    return 'لا يوجد نطاق محل: عيّن محلاً لهذا المستخدم، أو مرّر shop_id، أو أرسل الحقل shop داخل جسم الطلب (للمستخدم الخارق).'
  }
  if (lang === 'en') return detail
  return 'تکایە سەرەتا فرۆشگایەک دیاری بکە'
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isApiStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status
}

export function setBasicAuth(user: string | null, pass: string | null) {
  basicUser = user
  basicPass = pass
}

/** Persist Basic auth in sessionStorage for same-tab navigation (internal tool). */
export function persistSessionAuth(email: string, password: string) {
  try {
    sessionStorage.setItem(SESSION_AUTH_KEY, btoa(`${email}:${password}`))
  } catch {
    /* ignore */
  }
}

export function clearSessionAuth() {
  sessionStorage.removeItem(SESSION_AUTH_KEY)
}

/** True when saved Basic auth exists (session restore will run on load). */
export function hasPersistedSessionAuth(): boolean {
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) != null
  } catch {
    return false
  }
}

export function restoreSessionAuth(): boolean {
  const raw = sessionStorage.getItem(SESSION_AUTH_KEY)
  if (!raw) return false
  try {
    const decoded = atob(raw)
    const i = decoded.indexOf(':')
    if (i < 1) return false
    const email = decoded.slice(0, i)
    const pass = decoded.slice(i + 1)
    setBasicAuth(email, pass)
    return true
  } catch {
    return false
  }
}

export function setSuperuserShopId(id: string | null) {
  superuserShopId = id
}

export function getSuperuserShopId() {
  return superuserShopId
}

export function getGlobalView(): boolean {
  try {
    return sessionStorage.getItem(GLOBAL_VIEW_KEY) === '1'
  } catch {
    return false
  }
}

/** Persisted for the tab session. Only meaningful for superusers. */
export function setGlobalView(on: boolean) {
  try {
    sessionStorage.setItem(GLOBAL_VIEW_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function authHeaders(): HeadersInit {
  if (!basicUser || !basicPass) return {}
  const token = btoa(`${basicUser}:${basicPass}`)
  return { Authorization: `Basic ${token}` }
}

/**
 * Build an absolute API URL. Adds `shop_id` when a superuser shop override is set
 * and Global View is off (scoped requests).
 * Pass `omitShopScope` for admin lists that must see all shops regardless of override.
 * Pass `shopScoped: true` to always attach `shop_id` when an override exists (e.g. receipt
 * settings) even in Global View — those endpoints require `require_shop_id` on the server.
 */
export function buildApiUrl(
  path: string,
  omitShopScope = false,
  shopScoped = false,
): string {
  let p = path.startsWith('/') ? path : `/${path}`
  const attachShopId =
    Boolean(superuserShopId) &&
    !omitShopScope &&
    (shopScoped || !getGlobalView())
  if (attachShopId) {
    const join = p.includes('?') ? '&' : '?'
    p = `${p}${join}shop_id=${encodeURIComponent(superuserShopId!)}`
  }
  return `${getApiBase()}${p}`
}

export type ApiFetchOptions = RequestInit & {
  omitShopScope?: boolean
  /** Superuser: send `shop_id` even when Global View is on (tenant-specific APIs). */
  shopScoped?: boolean
}

export async function apiFetch(path: string, init: ApiFetchOptions = {}) {
  const { omitShopScope, shopScoped, ...rest } = init
  const url = buildApiUrl(path, Boolean(omitShopScope), Boolean(shopScoped))
  const headers = new Headers(rest.headers)
  const a = authHeaders() as Record<string, string>
  if (a.Authorization) headers.set('Authorization', a.Authorization)
  if (
    !(rest.body instanceof FormData) &&
    rest.body &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const method = (rest.method ?? 'GET').toString().toUpperCase()
  const cache: RequestCache | undefined =
    rest.cache ??
    (method === 'GET' || method === 'HEAD' ? 'no-store' : ('default' as RequestCache))
  return fetch(url, { ...rest, headers, cache })
}

async function apiFetchWithBase(
  base: string,
  path: string,
  init: ApiFetchOptions = {},
) {
  const { omitShopScope, shopScoped, ...rest } = init
  let p = path.startsWith('/') ? path : `/${path}`
  const attachShopId =
    Boolean(superuserShopId) &&
    !omitShopScope &&
    (Boolean(shopScoped) || !getGlobalView())
  if (attachShopId) {
    const join = p.includes('?') ? '&' : '?'
    p = `${p}${join}shop_id=${encodeURIComponent(superuserShopId!)}`
  }
  const url = `${base.replace(/\/$/, '')}${p}`
  const headers = new Headers(rest.headers)
  const a = authHeaders() as Record<string, string>
  if (a.Authorization) headers.set('Authorization', a.Authorization)
  if (
    !(rest.body instanceof FormData) &&
    rest.body &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  const method = (rest.method ?? 'GET').toString().toUpperCase()
  const cache: RequestCache | undefined =
    rest.cache ??
    (method === 'GET' || method === 'HEAD' ? 'no-store' : ('default' as RequestCache))
  return fetch(url, { ...rest, headers, cache })
}

function formatJsonErrorValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((v) => formatJsonErrorValue(v)).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

export async function apiJson<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  let res: Response | null = null
  const base = getApiBase()
  try {
    res = await apiFetch(path, init)
  } catch (e) {
    const method = (init.method ?? 'GET').toString().toUpperCase()
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const isNetworkFailure = e instanceof TypeError
    const canQueueBody =
      init.body == null || typeof init.body === 'string' || init.body instanceof URLSearchParams
    if (isMutating && isNetworkFailure && canQueueBody) {
      const headers = new Headers(init.headers)
      if (init.body != null && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json')
      }
      enqueueOfflineRequest({
        path,
        method,
        headers: Array.from(headers.entries()),
        bodyText: init.body == null ? null : String(init.body),
        omitShopScope: Boolean(init.omitShopScope),
        shopScoped: Boolean(init.shopScoped),
      })
      throw new ApiError(OFFLINE_QUEUED_HINT, 0)
    }
    if (e instanceof TypeError && import.meta.env.DEV && !isLocalApiBase(base)) {
      try {
        res = await apiFetchWithBase('http://127.0.0.1:8000', path, init)
      } catch {
        // Keep original error message plus guidance below.
      }
    }
    if (!res) {
      const hint =
        e instanceof TypeError
          ? isLocalApiBase(base)
            ? ` (cannot reach ${base}; start the Django backend, e.g. run-backend.ps1 on 0.0.0.0:8000)`
            : ` (cannot reach ${base}; same Wi-Fi as this device, Django on 0.0.0.0:8000, DJANGO_ALLOWED_HOSTS / DJANGO_DEV_FRONTEND_ORIGINS; open the app via http://YOUR_PC_IP:5173 with VITE_DEV_LAN=1)`
          : ''
      throw new ApiError(
        `${e instanceof Error ? e.message : String(e)}${hint}`,
        0,
      )
    }
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as Record<string, unknown>
      if (j.detail !== undefined) {
        detail = String(j.detail)
      } else {
        const parts: string[] = []
        for (const [k, v] of Object.entries(j)) {
          if (k === 'detail') continue
          const formatted = formatJsonErrorValue(v)
          if (formatted) parts.push(`${k}: ${formatted}`)
        }
        if (parts.length) detail = parts.join(' ')
      }
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    detail = translateApiDetail(detail)
    throw new ApiError(detail || `HTTP ${res.status}`, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function flushOfflineQueue(): Promise<void> {
  if (isFlushingOfflineQueue) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  isFlushingOfflineQueue = true
  try {
    while (true) {
      const item = peekOfflineQueue()
      if (!item) break
      try {
        const body: BodyInit | undefined = item.bodyText == null ? undefined : item.bodyText
        const res = await apiFetch(item.path, {
          method: item.method,
          headers: item.headers,
          body,
          omitShopScope: item.omitShopScope,
          shopScoped: item.shopScoped,
        })
        if (res.ok) {
          shiftOfflineQueue()
          continue
        }
        // Drop unrecoverable server-side errors to unblock later items.
        if (res.status >= 400 && res.status < 500) {
          shiftOfflineQueue()
          continue
        }
        const next = { ...item, attempts: item.attempts + 1 }
        replaceFirstQueueItem(next)
        break
      } catch {
        const next = { ...item, attempts: item.attempts + 1 }
        replaceFirstQueueItem(next)
        break
      }
    }
  } finally {
    isFlushingOfflineQueue = false
  }
}

export function initOfflineAutoSync() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void flushOfflineQueue()
  })
  if (navigator.onLine) {
    void flushOfflineQueue()
  }
}

/** Unauthenticated JSON GET for public endpoints (no Basic auth, no shop scope). */
export async function publicApiJson<T>(path: string): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${getApiBase()}${p}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as Record<string, unknown>
      if (j.detail !== undefined) detail = String(j.detail)
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(detail || `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}
