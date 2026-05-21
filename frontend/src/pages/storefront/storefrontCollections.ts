import type { PublicStorefrontProduct, StorefrontProductCollection } from '../../api/storefrontApi'
import { isProductAvailable } from './productAvailability'

export type CatalogProductRow = {
  product: PublicStorefrontProduct
  categoryName: string
}

function discountPercent(product: PublicStorefrontProduct): number {
  const n = Number.parseFloat(String(product.online_discount_percent ?? 0))
  return Number.isFinite(n) ? n : 0
}

function unitsSold(product: PublicStorefrontProduct): number {
  const n = Number(product.units_sold ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function createdAtMs(product: PublicStorefrontProduct): number {
  if (!product.created_at) return 0
  const t = Date.parse(product.created_at)
  return Number.isFinite(t) ? t : 0
}

export function filterCatalogByCollection(
  rows: CatalogProductRow[],
  collection: StorefrontProductCollection | null,
  favoriteIds: number[],
): CatalogProductRow[] {
  if (!collection) return rows

  const favSet = new Set(favoriteIds)

  switch (collection) {
    case 'favorites':
      return rows.filter(({ product }) => favSet.has(product.id))
    case 'bestsellers': {
      const withSales = rows.filter(({ product }) => unitsSold(product) > 0)
      const pool = withSales.length > 0 ? withSales : rows
      return [...pool].sort((a, b) => unitsSold(b.product) - unitsSold(a.product))
    }
    case 'new_arrivals':
      return [...rows].sort((a, b) => createdAtMs(b.product) - createdAtMs(a.product))
    case 'on_sale':
      return rows.filter(({ product }) => discountPercent(product) > 0)
    case 'available_now':
      return rows.filter(({ product }) => isProductAvailable(product))
    default:
      return rows
  }
}

export function collectionTitleKey(
  collection: StorefrontProductCollection | null,
): keyof import('./storefrontStrings').StorefrontStrings | null {
  if (!collection) return null
  const map: Record<
    StorefrontProductCollection,
    keyof import('./storefrontStrings').StorefrontStrings
  > = {
    bestsellers: 'bestsellers',
    new_arrivals: 'newArrivals',
    on_sale: 'onSale',
    available_now: 'availableNow',
    favorites: 'myFavorites',
  }
  return map[collection]
}
