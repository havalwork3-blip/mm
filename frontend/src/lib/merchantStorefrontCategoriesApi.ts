import { apiJson } from './api'

export type MerchantStorefrontCategoryCard = {
  id: number
  name_ku: string
  name_ar: string
  name_en: string
  image_url: string | null
  product_count: number
  storefront_home_order: number | null
  storefront_bg_from: string | null
  storefront_bg_to: string | null
}

export type StorefrontCategoryCardPatch = {
  id: number
  storefront_home_order?: number | null
  storefront_bg_from?: string
  storefront_bg_to?: string
}

export async function fetchMerchantStorefrontCategoryCards(): Promise<
  MerchantStorefrontCategoryCard[]
> {
  return apiJson<MerchantStorefrontCategoryCard[]>('/api/merchant/storefront-category-cards/', {
    shopScoped: true,
  })
}

export async function patchMerchantStorefrontCategoryCards(
  items: StorefrontCategoryCardPatch[],
): Promise<MerchantStorefrontCategoryCard[]> {
  return apiJson<MerchantStorefrontCategoryCard[]>('/api/merchant/storefront-category-cards/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify({ items }),
  })
}
