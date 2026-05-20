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
