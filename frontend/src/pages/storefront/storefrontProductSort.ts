import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import type { CatalogProductRow } from './storefrontCollections'
import { isProductAvailable } from './productAvailability'

export type ProductSortKey = 'default' | 'price_asc' | 'price_desc' | 'name' | 'newest'

export type ProductListFilters = {
  inStockOnly: boolean
  onSaleOnly: boolean
}

function unitPrice(product: PublicStorefrontProduct): number {
  const base =
    product.online_base_price != null && String(product.online_base_price).trim() !== ''
      ? product.online_base_price
      : product.sell_price
  const n = Number.parseFloat(String(base))
  return Number.isFinite(n) ? n : 0
}

function discountPct(product: PublicStorefrontProduct): number {
  const n = Number.parseFloat(String(product.online_discount_percent ?? 0))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function createdMs(product: PublicStorefrontProduct): number {
  if (!product.created_at) return 0
  const t = Date.parse(product.created_at)
  return Number.isFinite(t) ? t : 0
}

export function applyProductListFilters(
  rows: CatalogProductRow[],
  filters: ProductListFilters,
): CatalogProductRow[] {
  let out = rows
  if (filters.inStockOnly) {
    out = out.filter(({ product }) => isProductAvailable(product))
  }
  if (filters.onSaleOnly) {
    out = out.filter(({ product }) => discountPct(product) > 0)
  }
  return out
}

export function sortProductRows(rows: CatalogProductRow[], sortKey: ProductSortKey): CatalogProductRow[] {
  if (sortKey === 'default') return rows
  const copy = [...rows]
  switch (sortKey) {
    case 'price_asc':
      return copy.sort((a, b) => unitPrice(a.product) - unitPrice(b.product))
    case 'price_desc':
      return copy.sort((a, b) => unitPrice(b.product) - unitPrice(a.product))
    case 'name':
      return copy.sort((a, b) => a.product.name.localeCompare(b.product.name, undefined, { sensitivity: 'base' }))
    case 'newest':
      return copy.sort((a, b) => createdMs(b.product) - createdMs(a.product))
    default:
      return rows
  }
}
