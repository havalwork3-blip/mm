import { apiJson } from './api'

export type OnlineProductPricingRow = {
  id: number
  name: string
  category_id: number
  category_name: string
  sale_price_retail: string
  online_sale_price: string | null
  online_discount_percent: string
  online_discount_min_quantity: number
  current_stock_quantity: number
  is_discontinued: boolean
  image_url: string | null
  effective_price: string
}

export type OnlinePricingPatchBody = {
  items?: Array<{
    id: number
    online_sale_price?: string | null
    online_discount_percent?: string | number
    online_discount_min_quantity?: number
  }>
  bulk_discount?: {
    online_discount_percent?: string | number
    online_discount_min_quantity?: number
  }
}

export async function fetchOnlineProductPricing(): Promise<OnlineProductPricingRow[]> {
  return apiJson<OnlineProductPricingRow[]>('/api/merchant/online-product-pricing/', {
    shopScoped: true,
  })
}

export async function patchOnlineProductPricing(
  body: OnlinePricingPatchBody,
): Promise<OnlineProductPricingRow[]> {
  return apiJson<OnlineProductPricingRow[]>('/api/merchant/online-product-pricing/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify(body),
  })
}
