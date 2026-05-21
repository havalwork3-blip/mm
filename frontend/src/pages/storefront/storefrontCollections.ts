import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct,
  StorefrontProductCollection,
} from '../../api/storefrontApi'
import { categoryDisplayName } from '../../lib/categoryNames'
import type { Lang } from '../../i18n/strings'
import { isProductAvailable } from './productAvailability'
import type { StorefrontStrings } from './storefrontStrings'

export const COLLECTION_PREVIEW_COUNT = 4

export const STOREFRONT_COLLECTION_ORDER: StorefrontProductCollection[] = [
  'bestsellers',
  'new_arrivals',
  'on_sale',
  'available_now',
  'favorites',
]

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

export function buildCatalogRows(
  categories: PublicStorefrontCategory[],
  lang: Lang,
): CatalogProductRow[] {
  return categories.flatMap((c) =>
    c.products.map((p) => ({
      product: p,
      categoryName: categoryDisplayName(c, lang),
    })),
  )
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

export function previewCollectionProducts(
  rows: CatalogProductRow[],
  collection: StorefrontProductCollection,
  favoriteIds: number[],
  limit = COLLECTION_PREVIEW_COUNT,
): CatalogProductRow[] {
  return filterCatalogByCollection(rows, collection, favoriteIds).slice(0, limit)
}

export function collectionTitle(
  s: StorefrontStrings,
  collection: StorefrontProductCollection | null,
): string | null {
  if (!collection) return null
  switch (collection) {
    case 'bestsellers':
      return s.bestsellers
    case 'new_arrivals':
      return s.newArrivals
    case 'on_sale':
      return s.onSale
    case 'available_now':
      return s.availableNow
    case 'favorites':
      return s.myFavorites
    default:
      return null
  }
}
