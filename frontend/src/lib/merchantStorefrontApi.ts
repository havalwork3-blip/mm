import { apiJson } from './api'
import type {
  MerchantStorefrontOrderRow,
  Paginated,
  StorefrontOrderStatus,
} from '../types/api'

function asOrderList(
  data: MerchantStorefrontOrderRow[] | Paginated<MerchantStorefrontOrderRow>,
): MerchantStorefrontOrderRow[] {
  return Array.isArray(data) ? data : data.results
}

export type OnlineStorefrontOrderStats = {
  order_count: number
  total_sales_usd: string
  pending_count: number
  processing_count: number
  completed_count: number
  cancelled_count: number
}

export async function fetchMerchantStorefrontOrderStats(
  query = '',
): Promise<OnlineStorefrontOrderStats> {
  return apiJson<OnlineStorefrontOrderStats>(
    `/api/merchant/storefront-orders/stats/${query}`,
    { shopScoped: true },
  )
}

export async function fetchMerchantStorefrontPendingCount(): Promise<{
  pending_count: number
}> {
  return apiJson<{ pending_count: number }>(
    '/api/merchant/storefront-orders/pending-count/',
    { shopScoped: true },
  )
}

export async function fetchMerchantStorefrontOrders(): Promise<
  MerchantStorefrontOrderRow[]
> {
  const data = await apiJson<
    MerchantStorefrontOrderRow[] | Paginated<MerchantStorefrontOrderRow>
  >('/api/merchant/storefront-orders/')
  return asOrderList(data)
}

export async function fetchMerchantStorefrontOrder(
  id: number,
): Promise<MerchantStorefrontOrderRow> {
  return apiJson<MerchantStorefrontOrderRow>(
    `/api/merchant/storefront-orders/${id}/`,
  )
}

export async function patchMerchantStorefrontOrderStatus(
  id: number,
  status: StorefrontOrderStatus,
): Promise<MerchantStorefrontOrderRow> {
  return apiJson<MerchantStorefrontOrderRow>(
    `/api/merchant/storefront-orders/${id}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  )
}
