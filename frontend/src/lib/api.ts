import {
  enqueueOfflineRequest,
  moveOfflineQueueItemToFailed,
  peekOfflineQueue,
  removeOfflineQueueItem,
  replaceOfflineQueueItem,
  scrubStoredOfflineCredentials,
} from './offlineQueue'
import { sanitizeApiErrorText } from './sanitizeApiError'

/** Local multi-shop Django from `npm run dev` (see scripts/run-django-backend.mjs). */
export const LOCAL_DJANGO_PORT = '8001'

/** Central API origin for mmiraq.com tenant storefronts (catalog/checkout). */
export const MMIRAq_DASHBOARD_API_ORIGIN = 'https://dashboard.mmiraq.com'

function isMmiraqTenantHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'mmiraq.com' || h.endsWith('.mmiraq.com')
}

/**
 * Site origin for API calls (no `/api` suffix). Every `apiJson` path already starts with `/api/…`.
 * Order: `VITE_API_URL` → same host on dev port (LAN) → localhost:8001 → same-origin (prod).
 */
function normalizeApiBase(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  // `VITE_API_URL=https://example.com/api` + path `/api/users/me/` → double `/api/api/…`
  if (/\/api$/i.test(base)) {
    base = base.slice(0, -4)
  }
  return base
}

/** Join site origin (no /api suffix) + path that starts with `/api/`. */
export function joinApiOrigin(origin: string, apiPath: string): string {
  const base = normalizeApiBase(origin)
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  if (!path.startsWith('/api/') && path !== '/api') {
    throw new Error(`API path must start with /api/: ${path}`)
  }
  return `${base}${path}`
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    // Local Vite dev: always same-origin so /api proxies to Django (ignores VITE_API_URL).
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin
    }
  }
  const env = import.meta.env.VITE_API_URL?.trim()
  if (env) return normalizeApiBase(env)
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // Production build on a real hostname: same-origin (e.g. Nginx → Gunicorn on /api/).
      if (import.meta.env.PROD) return window.location.origin
      return `${protocol}//${hostname}:${LOCAL_DJANGO_PORT}`
    }
  }
  return `http://127.0.0.1:${LOCAL_DJANGO_PORT}`
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

/** Signed-in email (for the offline queue owner) and the login token from /api/auth/login/. */
let authEmail: string | null = null
let authToken: string | null = null
/** When set, appended as ?shop_id= for every request (superuser impersonation). */
let superuserShopId: string | null = null
let isFlushingOfflineQueue = false

const SESSION_AUTH_KEY = 'pos_session_auth'
/** When "1", superuser API calls omit ?shop_id= (global multi-tenant lists). */
const GLOBAL_VIEW_KEY = 'pos_global_view'
export const OFFLINE_QUEUED_HINT =
  'No internet. Your change was saved locally and will sync automatically when connection is back.'
const NO_SHOP_SCOPE_DETAIL =
  'No shop scope: assign a shop to this user, pass shop_id, or include shop in the request body (superuser).'

function translateApiDetail(detail: string): string {
  const lowered = detail.toLowerCase()
  if (
    lowered.includes('invalid username/password') ||
    lowered.includes('invalid email or password') ||
    lowered.includes('authentication credentials were not provided') ||
    lowered.includes('credentials were not provided')
  ) {
    const lang =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('ui_lang') : null) || 'ku'
    if (lang === 'ar') return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
    if (lang === 'en') return 'Invalid email or password.'
    return 'ئیمەیڵ یان وشەی نهێنی هەڵەیە.'
  }
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

/** Login failures on this API often return 403 (not 401) when session cookies interfere. */
export function isApiAuthFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  if (error.status === 401) return true
  if (error.status !== 403) return false
  const detail = error.message.toLowerCase()
  return (
    detail.includes('invalid email or password') ||
    detail.includes('invalid username/password') ||
    detail.includes('authentication credentials were not provided') ||
    detail.includes('credentials were not provided')
  )
}

export function setAuthSession(email: string | null, token: string | null) {
  authEmail = email
  authToken = token
  // Offline sales wait for their owner to be signed in; send them as soon as the session is known
  // (login or restore after reload), not only on the next 'online' event.
  if (email && token) {
    setTimeout(() => {
      void flushOfflineQueue()
    }, 0)
  }
}

/** Keep the login token (never the password) in sessionStorage for this tab. */
export function persistSessionAuth(email: string, token: string) {
  try {
    sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify({ email, token }))
  } catch {
    /* ignore */
  }
}

/** Exchange email + password for a login token; the password is not kept anywhere. */
export async function requestLoginToken(email: string, password: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'omit',
  })
  const data = (await res.json().catch(() => ({}))) as { token?: string; detail?: string }
  if (!res.ok || !data.token) {
    throw new ApiError(data.detail || `HTTP ${res.status}`, res.status === 429 ? 429 : 401)
  }
  return data.token
}

/** End this login session on the server (best effort). */
export function revokeLoginToken() {
  if (!authToken) return
  void fetch(`${getApiBase()}/api/auth/logout/`, {
    method: 'POST',
    headers: { Authorization: `Token ${authToken}` },
    credentials: 'omit',
  }).catch(() => {
    /* offline: the token still expires after two idle weeks */
  })
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
    const parsed = JSON.parse(raw) as { email?: string; token?: string }
    if (!parsed.token) throw new Error('old format')
    setAuthSession(parsed.email ?? null, parsed.token)
    return true
  } catch {
    // Older builds stored the password here; drop it and ask for a fresh sign-in.
    sessionStorage.removeItem(SESSION_AUTH_KEY)
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
  if (!authToken) return {}
  return { Authorization: `Token ${authToken}` }
}

/** Superuser tenant scope: memory override, or `pos_shop_id` when `shopScoped` (even in Global View). */
function scopedShopIdForRequest(shopScoped: boolean): string | null {
  const mem = superuserShopId?.trim() || null
  if (mem) return mem
  if (!shopScoped) return null
  try {
    return localStorage.getItem('pos_shop_id')?.trim() || null
  } catch {
    return null
  }
}

/**
 * Build an absolute API URL. Adds `shop_id` when a superuser shop override is set
 * and Global View is off (scoped requests).
 * Pass `omitShopScope` for admin lists that must see all shops regardless of override.
 * Pass `shopScoped: true` to always attach `shop_id` when `pos_shop_id` is set (e.g. sales,
 * POS, receipt settings) even in Global View — those endpoints require `require_shop_id` on the server.
 */
export function buildApiUrl(
  path: string,
  omitShopScope = false,
  shopScoped = false,
): string {
  let p = path.startsWith('/') ? path : `/${path}`
  const sid = scopedShopIdForRequest(shopScoped)
  const attachShopId =
    Boolean(sid) &&
    !omitShopScope &&
    (shopScoped || !getGlobalView())
  if (attachShopId && sid) {
    const join = p.includes('?') ? '&' : '?'
    p = `${p}${join}shop_id=${encodeURIComponent(sid)}`
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
  return fetch(url, { ...rest, headers, cache, credentials: 'omit' })
}

async function apiFetchWithBase(
  base: string,
  path: string,
  init: ApiFetchOptions = {},
) {
  const { omitShopScope, shopScoped, ...rest } = init
  let p = path.startsWith('/') ? path : `/${path}`
  const sid = scopedShopIdForRequest(Boolean(shopScoped))
  const isMeEndpoint = p.startsWith('/api/users/me')
  const attachShopId =
    !isMeEndpoint &&
    Boolean(sid) &&
    !omitShopScope &&
    (Boolean(shopScoped) || !getGlobalView())
  if (attachShopId && sid) {
    const join = p.includes('?') ? '&' : '?'
    p = `${p}${join}shop_id=${encodeURIComponent(sid)}`
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
  return fetch(url, { ...rest, headers, cache, credentials: 'omit' })
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

function makeIdempotencyKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export async function apiJson<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  // Every write carries a unique key. The same key is kept if the request is queued offline and
  // replayed, so the server applies it at most once (no duplicate sales / payments / returns).
  {
    const m = (init.method ?? 'GET').toString().toUpperCase()
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) {
      const h = new Headers(init.headers)
      if (!h.has('Idempotency-Key')) {
        h.set('Idempotency-Key', makeIdempotencyKey())
        init = { ...init, headers: Array.from(h.entries()) }
      }
    }
  }
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
      // Freeze the shop scope now: by replay time another shop may be selected.
      const scopedUrl = buildApiUrl(path, Boolean(init.omitShopScope), Boolean(init.shopScoped))
      enqueueOfflineRequest({
        path: scopedUrl.slice(getApiBase().length),
        method,
        headers: Array.from(headers.entries()).filter(([k]) => k.toLowerCase() !== 'authorization'),
        bodyText: init.body == null ? null : String(init.body),
        omitShopScope: true,
        shopScoped: false,
        ownerEmail: authEmail,
      })
      throw new ApiError(OFFLINE_QUEUED_HINT, 0)
    }
    if (e instanceof TypeError && import.meta.env.DEV && !isLocalApiBase(base)) {
      try {
        res = await apiFetchWithBase(`http://127.0.0.1:${LOCAL_DJANGO_PORT}`, path, init)
      } catch {
        // Keep original error message plus guidance below.
      }
    }
    if (!res) {
      const hint =
        e instanceof TypeError
          ? isLocalApiBase(base)
            ? ` (cannot reach ${base}; start the Django backend: npm run dev — default port ${LOCAL_DJANGO_PORT})`
            : ` (cannot reach ${base}; same Wi-Fi as this device, Django on 0.0.0.0:${LOCAL_DJANGO_PORT}, DJANGO_ALLOWED_HOSTS / DJANGO_DEV_FRONTEND_ORIGINS; open the app via http://YOUR_PC_IP:5180 with VITE_DEV_LAN=1)`
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
        detail = translateApiDetail(sanitizeApiErrorText(detail, res.status))
        if (res.status === 404 && detail.toLowerCase().includes('shop not found')) {
          try {
            // Never drop the offline queue here: it may hold unsynced sales.
            localStorage.removeItem('pos_shop_id')
          } catch {
            /* ignore */
          }
          setSuperuserShopId(null)
        }
        if (res.status === 403 && detail === NO_SHOP_SCOPE_DETAIL) {
          try {
            localStorage.removeItem('pos_shop_id')
          } catch {
            /* ignore */
          }
          setSuperuserShopId(null)
        }
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
    if (!authToken) return
    const me = (authEmail ?? '').toLowerCase()
    while (true) {
      // Only the user who made these offline sales may send them; other users' items wait.
      const item = peekOfflineQueue((it) => !it.ownerEmail || it.ownerEmail.toLowerCase() === me)
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
          removeOfflineQueueItem(item.id)
          continue
        }
        // Unrecoverable server-side errors: set aside (not deleted) to unblock later items.
        if (res.status === 401) break
        // Same request still being processed on the server: try again later.
        if (res.status === 409 && res.headers.get('Idempotency-Status') === 'in-progress') {
          replaceOfflineQueueItem({ ...item, attempts: item.attempts + 1 })
          break
        }
        if (res.status >= 400 && res.status < 500) {
          const detail = await res.text().catch(() => '')
          console.warn('Offline request rejected on replay', item.path, res.status, detail)
          moveOfflineQueueItemToFailed(item.id, res.status, detail.slice(0, 500))
          continue
        }
        replaceOfflineQueueItem({ ...item, attempts: item.attempts + 1 })
        break
      } catch {
        replaceOfflineQueueItem({ ...item, attempts: item.attempts + 1 })
        break
      }
    }
  } finally {
    isFlushingOfflineQueue = false
  }
}

export function initOfflineAutoSync() {
  if (typeof window === 'undefined') return
  scrubStoredOfflineCredentials()
  window.addEventListener('online', () => {
    void flushOfflineQueue()
  })
  if (navigator.onLine) {
    void flushOfflineQueue()
  }
}

/**
 * Base origin for unauthenticated public APIs (storefront, QR landing).
 * - localhost: Vite proxy → Django
 * - *.mmiraq.com storefront hosts: always dashboard API (cross-subdomain CORS)
 * - otherwise: same as getApiBase()
 */
export function getPublicApiBase(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin
    }
    if (isMmiraqTenantHostname(hostname)) {
      const env = import.meta.env.VITE_API_URL?.trim()
      return normalizeApiBase(env || MMIRAq_DASHBOARD_API_ORIGIN)
    }
  }
  return getApiBase()
}

/** Unauthenticated JSON GET for public endpoints (no Basic auth, no shop scope). */
export async function publicApiJson<T>(path: string): Promise<T> {
  const url = joinApiOrigin(getPublicApiBase(), path)
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

/** True when a write failed only because the device is offline and it was queued for sync. */
export function isOfflineQueuedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0 && error.message === OFFLINE_QUEUED_HINT
}
