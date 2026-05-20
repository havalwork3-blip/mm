import { apiFetch, apiJson } from './api'
import { parseApiErrorBody } from './parseApiError'

export type StorefrontBannerLinkType = 'none' | 'url' | 'category'

export type MerchantStorefrontBanner = {
  id: number
  shop: number
  sort_order: number
  title: string
  subtitle: string
  image: string | null
  image_url: string | null
  link_type: StorefrontBannerLinkType
  link_url: string
  category: number | null
  category_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function fetchMerchantStorefrontBanners(): Promise<MerchantStorefrontBanner[]> {
  return apiJson<MerchantStorefrontBanner[]>('/api/merchant/storefront-banners/', {
    shopScoped: true,
  })
}

export async function createMerchantStorefrontBanner(
  form: FormData,
): Promise<MerchantStorefrontBanner> {
  const res = await apiFetch('/api/merchant/storefront-banners/', {
    method: 'POST',
    shopScoped: true,
    body: form,
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(parseApiErrorBody(j, res.statusText))
  }
  return res.json() as Promise<MerchantStorefrontBanner>
}

export async function updateMerchantStorefrontBanner(
  id: number,
  form: FormData,
): Promise<MerchantStorefrontBanner> {
  const res = await apiFetch(`/api/merchant/storefront-banners/${id}/`, {
    method: 'PATCH',
    shopScoped: true,
    body: form,
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(parseApiErrorBody(j, res.statusText))
  }
  return res.json() as Promise<MerchantStorefrontBanner>
}

export async function deleteMerchantStorefrontBanner(id: number): Promise<void> {
  const res = await apiFetch(`/api/merchant/storefront-banners/${id}/`, {
    method: 'DELETE',
    shopScoped: true,
  })
  if (!res.ok && res.status !== 204) {
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(parseApiErrorBody(j, res.statusText))
  }
}

export async function reorderMerchantStorefrontBanners(order: number[]): Promise<MerchantStorefrontBanner[]> {
  return apiJson<MerchantStorefrontBanner[]>('/api/merchant/storefront-banners/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify({ order }),
  })
}
