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

/** Home-page highlight rows (favorites via header). */
export const STOREFRONT_HOME_COLLECTIONS = [
  'bestsellers',
  'best_deals',
  'on_sale',
  'new_arrivals',
  'budget_picks',
  'available_now',
  'premium',
  'recently_viewed',
] as const satisfies readonly StorefrontProductCollection[]

export type StorefrontHomeCollection = (typeof STOREFRONT_HOME_COLLECTIONS)[number]

export type CatalogProductRow = {
  product: PublicStorefrontProduct
  categoryName: string
}

function discountPercent(product: PublicStorefrontProduct): number {
  const n = Number.parseFloat(String(product.online_discount_percent ?? 0))
  return Number.isFinite(n) ? n : 0
}

function sellPrice(product: PublicStorefrontProduct): number {
  const n = Number.parseFloat(product.sell_price)
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
  recentIds: number[] = [],
): CatalogProductRow[] {
  if (!collection) return rows

  const favSet = new Set(favoriteIds)
  const byProductId = new Map(rows.map((r) => [r.product.id, r]))

  switch (collection) {
    case 'favorites':
      return rows.filter(({ product }) => favSet.has(product.id))
    case 'bestsellers': {
      const withSales = rows.filter(({ product }) => unitsSold(product) > 0)
      const pool = withSales.length > 0 ? withSales : rows
      return [...pool].sort((a, b) => unitsSold(b.product) - unitsSold(a.product))
    }
    case 'best_deals':
      return [...rows]
        .filter(({ product }) => isProductAvailable(product) && discountPercent(product) > 0)
        .sort((a, b) => discountPercent(b.product) - discountPercent(a.product))
    case 'new_arrivals':
      return [...rows].sort((a, b) => createdAtMs(b.product) - createdAtMs(a.product))
    case 'on_sale':
      return rows.filter(({ product }) => discountPercent(product) > 0)
    case 'budget_picks':
      return [...rows]
        .filter(({ product }) => isProductAvailable(product))
        .sort((a, b) => sellPrice(a.product) - sellPrice(b.product))
    case 'premium':
      return [...rows]
        .filter(({ product }) => isProductAvailable(product))
        .sort((a, b) => sellPrice(b.product) - sellPrice(a.product))
    case 'available_now':
      return rows.filter(({ product }) => isProductAvailable(product))
    case 'recently_viewed':
      return recentIds
        .map((id) => byProductId.get(id))
        .filter((row): row is CatalogProductRow => row != null)
    default:
      return rows
  }
}

export function previewCollectionProducts(
  rows: CatalogProductRow[],
  collection: StorefrontProductCollection,
  favoriteIds: number[],
  recentIds: number[],
  limit = COLLECTION_PREVIEW_COUNT,
): CatalogProductRow[] {
  return filterCatalogByCollection(rows, collection, favoriteIds, recentIds).slice(0, limit)
}

export function collectionTitle(
  s: StorefrontStrings,
  collection: StorefrontProductCollection | null,
): string | null {
  if (!collection) return null
  switch (collection) {
    case 'bestsellers':
      return s.bestsellers
    case 'best_deals':
      return s.bestDeals
    case 'new_arrivals':
      return s.newArrivals
    case 'on_sale':
      return s.onSale
    case 'budget_picks':
      return s.budgetPicks
    case 'premium':
      return s.premium
    case 'available_now':
      return s.availableNow
    case 'recently_viewed':
      return s.recentlyViewed
    case 'favorites':
      return s.myFavorites
    default:
      return null
  }
}
