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

export type ContactMessageRow = {
  id: number
  name: string
  email: string
  message: string
  lang: string
  is_read: boolean
  ip_address: string | null
  created_at: string
}

export type ContactStats = { total: number; unread: number }

export type LocalizedText = { ckb?: string; ar?: string; en?: string }

export type MarketingProductCategory = {
  id: number
  page: string
  title: LocalizedText
  sort_order: number
  is_published: boolean
}

export type MarketingProductCard = {
  id: number
  page: string
  category_id: number | null
  title: LocalizedText
  tag: { key?: string; text?: LocalizedText }
  image_url: string | null
  link_url: string
  tone: string
  sort_order: number
  is_published: boolean
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

export async function fetchContactStats() {
  return marketingApiJson<ContactStats>('/api/marketing/contact/stats/')
}

export async function fetchContactMessages(unreadOnly = false) {
  const q = unreadOnly ? '?unread=1' : ''
  return marketingApiJson<ContactMessageRow[]>(`/api/marketing/contact/${q}`)
}

export async function patchContactMessage(id: number, data: { is_read: boolean }) {
  return marketingApiJson<ContactMessageRow>(`/api/marketing/contact/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteContactMessage(id: number) {
  return marketingApiJson<void>(`/api/marketing/contact/${id}/`, { method: 'DELETE' })
}

export async function marketingApiForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  const base = getMarketingApiBase()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers()
  const token = restoreMarketingToken()
  if (token) headers.set('Authorization', `MarketingToken ${token}`)
  const res = await fetch(url, { method, headers, body: form })
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

export async function fetchProductCategories(page: string) {
  return marketingApiJson<MarketingProductCategory[]>(`/api/marketing/product-categories/?page=${encodeURIComponent(page)}`)
}

export async function createProductCategory(data: Partial<MarketingProductCategory>) {
  return marketingApiJson<MarketingProductCategory>('/api/marketing/product-categories/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteProductCategory(id: number) {
  return marketingApiJson<void>(`/api/marketing/product-categories/${id}/`, { method: 'DELETE' })
}

export async function fetchProducts(page: string) {
  return marketingApiJson<MarketingProductCard[]>(`/api/marketing/products/?page=${encodeURIComponent(page)}`)
}

export async function createProduct(data: Record<string, unknown>, image?: File | null) {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  })
  if (image) form.append('image', image)
  return marketingApiForm<MarketingProductCard>('/api/marketing/products/', form)
}

export async function updateProduct(id: number, data: Record<string, unknown>, image?: File | null) {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
  })
  if (image) form.append('image', image)
  return marketingApiForm<MarketingProductCard>(`/api/marketing/products/${id}/`, form, 'PATCH')
}

export async function deleteProduct(id: number) {
  return marketingApiJson<void>(`/api/marketing/products/${id}/`, { method: 'DELETE' })
}

export function isMarketingAuthError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null || !('status' in e)) return false
  const status = (e as { status: number }).status
  return status === 401 || status === 403
}
