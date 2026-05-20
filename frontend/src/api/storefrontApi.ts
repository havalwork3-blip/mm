import { ApiError, getPublicApiBase, joinApiOrigin, publicApiJson } from '../lib/api'

/** Paths under config.urls → api/ → inventory.urls (no extra api/ prefix in Django). */
const STOREFRONT_RESOLVE_PATH = '/api/public/storefront/resolve/'
const STOREFRONT_PRODUCTS_PATH = '/api/public/storefront/products/'
const STOREFRONT_CATALOG_PATH = '/api/public/storefront/catalog/'
const STOREFRONT_SUBMIT_PATH = '/api/public/storefront/submit_order/'

export type PublicStorefrontAppearance = {
  catalog_title: string
  catalog_subtitle: string
  welcome_message: string
  accent_color: string
  banner_rotate_seconds: number
}

export type PublicStorefrontBanner = {
  id: number
  title: string
  subtitle: string
  image_url: string | null
  link_type: 'none' | 'url' | 'category'
  link_url: string
  category_id: number | null
  category_name: string
}

export type PublicStorefrontResolve = {
  shop_id: number
  name: string
  storefront_host: string
  storefront?: PublicStorefrontAppearance
}

export type PublicStorefrontCategory = {
  id: number
  name: string
  name_ku: string
  name_ar: string
  name_en: string
  image_url: string | null
  products: PublicStorefrontProduct[]
}

export type PublicStorefrontCatalog = {
  storefront: PublicStorefrontAppearance
  banners: PublicStorefrontBanner[]
  categories: PublicStorefrontCategory[]
}

function resolveQuery(): string {
  if (typeof window === 'undefined') return ''
  const qs = new URLSearchParams(window.location.search)
  const params = new URLSearchParams()
  const shopId =
    qs.get('shop_id')?.trim() ||
    (import.meta.env.DEV ? import.meta.env.VITE_STOREFRONT_SHOP_ID?.trim() : '')
  if (shopId) params.set('shop_id', shopId)
  const hostOverride = qs.get('host')?.trim()
  const hostname = window.location.hostname
  const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1'
  if (hostOverride) {
    params.set('host', hostOverride)
  } else if (!isLocalDev) {
    params.set('host', hostname)
  }
  const q = params.toString()
  return q ? `?${q}` : ''
}

export async function resolvePublicStorefront(): Promise<PublicStorefrontResolve> {
  return publicApiJson<PublicStorefrontResolve>(
    `${STOREFRONT_RESOLVE_PATH}${resolveQuery()}`,
  )
}

export type ProductUnavailableReason = 'out_of_stock' | 'discontinued' | 'unavailable'

export type PublicStorefrontProduct = {
  id: number
  name: string
  sell_price: string
  barcode: string | null
  image: string | null
  image_url: string | null
  category_id?: number
  category_name?: string
  is_available: boolean
  unavailable_reason: ProductUnavailableReason | null
}

export type StorefrontOrderPayload = {
  shop: number
  customer_name: string
  customer_phone: string
  customer_address: string
  items: Array<{ product: number; quantity: number }>
}

export type StorefrontOrderResponse = {
  id: number
  shop: number
  customer_name: string
  customer_phone: string
  customer_address: string
  total_amount: string
  status: string
  items: Array<{
    id: number
    product: number
    product_name: string
    quantity: number
    unit_price: string
  }>
  created_at: string
  updated_at: string
}

export async function fetchPublicProducts(
  shopId: string | number,
): Promise<PublicStorefrontProduct[]> {
  const sid = encodeURIComponent(String(shopId))
  return publicApiJson<PublicStorefrontProduct[]>(
    `${STOREFRONT_PRODUCTS_PATH}?shop_id=${sid}`,
  )
}

export async function fetchPublicCatalog(
  shopId: string | number,
): Promise<PublicStorefrontCatalog> {
  const sid = encodeURIComponent(String(shopId))
  return publicApiJson<PublicStorefrontCatalog>(
    `${STOREFRONT_CATALOG_PATH}?shop_id=${sid}`,
  )
}

export async function submitPublicOrder(
  orderData: StorefrontOrderPayload,
): Promise<StorefrontOrderResponse> {
  const url = joinApiOrigin(getPublicApiBase(), STOREFRONT_SUBMIT_PATH)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as Record<string, unknown>
      if (j.detail !== undefined) detail = String(j.detail)
      else {
        const parts: string[] = []
        for (const [k, v] of Object.entries(j)) {
          if (v == null) continue
          parts.push(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
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
    throw new ApiError(detail || `HTTP ${res.status}`, res.status)
  }
  return res.json() as Promise<StorefrontOrderResponse>
}
