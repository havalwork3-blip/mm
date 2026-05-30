const STORAGE_KEY = 'mm_marketing_token'

export type MarketingEditorProfile = {
  id: number
  email: string
  display_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MarketingSiteContent = {
  translations: Record<string, Record<string, unknown>>
  sections: Record<string, { published?: boolean }>
  is_published: boolean
  updated_at: string | null
}

export function getMarketingApiBase(): string {
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin.replace(/:\d+$/, ':8001')
    }
  }
  const env = import.meta.env.VITE_API_URL as string | undefined
  if (env?.trim()) {
    return env.trim().replace(/\/+$/, '').replace(/\/api$/i, '')
  }
  return 'https://dashboard.mmiraq.com'
}

export function persistMarketingToken(token: string | null) {
  if (token) sessionStorage.setItem(STORAGE_KEY, token)
  else sessionStorage.removeItem(STORAGE_KEY)
}

export function restoreMarketingToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEY)
}

export async function marketingApiJson<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const base = getMarketingApiBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  const auth = init.auth !== false
  if (auth) {
    const token = restoreMarketingToken()
    if (token) headers.set('Authorization', `MarketingToken ${token}`)
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(detail), { status: res.status })
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function marketingLogin(email: string, password: string) {
  const data = await marketingApiJson<{
    token: string
    expires_at: string
    editor: MarketingEditorProfile
  }>('/api/marketing/auth/login/', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  })
  persistMarketingToken(data.token)
  return data
}

export async function marketingLogout() {
  try {
    await marketingApiJson('/api/marketing/auth/logout/', { method: 'POST' })
  } finally {
    persistMarketingToken(null)
  }
}

export async function fetchMarketingMe() {
  return marketingApiJson<MarketingEditorProfile>('/api/marketing/auth/me/')
}

export async function fetchMarketingSiteAdmin() {
  return marketingApiJson<MarketingSiteContent>('/api/marketing/site/')
}

export async function saveMarketingSite(content: Partial<MarketingSiteContent>) {
  return marketingApiJson<MarketingSiteContent>('/api/marketing/site/', {
    method: 'PATCH',
    body: JSON.stringify(content),
  })
}

export async function importMarketingDefaults() {
  return marketingApiJson<MarketingSiteContent>('/api/marketing/site/', {
    method: 'POST',
    body: JSON.stringify({ action: 'import_defaults' }),
  })
}

export function isMarketingAuthError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'status' in e && (e as { status: number }).status === 401
}
