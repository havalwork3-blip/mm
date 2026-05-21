import { apiJson } from './api'

export type OnlineGalleryImage = {
  id: number
  image_url: string | null
  sort_order: number
}

export type OnlineProductPricingRow = {
  id: number
  name: string
  category_id: number
  category_name: string
  sale_price_retail: string
  online_sale_price: string | null
  online_discount_percent: string
  online_discount_min_quantity: number
  online_description: string
  current_stock_quantity: number
  is_discontinued: boolean
  image_url: string | null
  gallery_images: OnlineGalleryImage[]
  effective_price: string
}

export type OnlinePricingPatchBody = {
  items?: Array<{
    id: number
    online_sale_price?: string | null
    online_discount_percent?: string | number
    online_discount_min_quantity?: number
    online_description?: string
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

export async function uploadOnlineProductGalleryImage(
  productId: number,
  file: File,
): Promise<OnlineGalleryImage> {
  const form = new FormData()
  form.append('image', file)
  return apiJson<OnlineGalleryImage>(
    `/api/merchant/online-product-pricing/${productId}/gallery/`,
    {
      method: 'POST',
      shopScoped: true,
      body: form,
    },
  )
}

export async function deleteOnlineProductGalleryImage(imageId: number): Promise<void> {
  await apiJson<void>(`/api/merchant/online-product-pricing/gallery/${imageId}/`, {
    method: 'DELETE',
    shopScoped: true,
  })
}
