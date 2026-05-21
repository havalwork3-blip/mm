import { apiJson } from './api'

export type StorefrontDeliveryZoneRow = {
  id: number
  shop: number
  name: string
  delivery_fee_usd: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

export type DeliveryZoneDraft = {
  id?: number
  name: string
  delivery_fee_usd: string
  delivery_fee_iqd: string
  sort_order: number
  is_active: boolean
}

export type StorefrontDeliveryConfig = {
  zones: StorefrontDeliveryZoneRow[]
  delivery_free_min_usd: string | null
}

export async function fetchStorefrontDeliveryZones(): Promise<StorefrontDeliveryConfig> {
  return apiJson<StorefrontDeliveryConfig>('/api/merchant/storefront-delivery-zones/', {
    shopScoped: true,
  })
}

export async function saveStorefrontDeliveryZones(
  zones: Array<{
    id?: number
    name: string
    delivery_fee_usd: string
    sort_order: number
    is_active: boolean
  }>,
  deliveryFreeMinUsd: string | null,
): Promise<StorefrontDeliveryConfig> {
  return apiJson<StorefrontDeliveryConfig>('/api/merchant/storefront-delivery-zones/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify({
      zones,
      delivery_free_min_usd: deliveryFreeMinUsd,
    }),
  })
}
