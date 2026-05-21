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

/** Home-page highlight rows (favorites open via header button). */
export const STOREFRONT_HOME_COLLECTIONS = [
  'bestsellers',
  'new_arrivals',
  'on_sale',
  'available_now',
] as const satisfies readonly StorefrontProductCollection[]

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

function productPriceUsd(product: PublicStorefrontProduct): number {
  const n = Number.parseFloat(product.sell_price)
  return Number.isFinite(n) ? n : 0
}

/** Mix favorites, cart (pricey first), same-category picks, then other in-stock items. */
export function personalizedAvailableProducts(
  rows: CatalogProductRow[],
  favoriteIds: number[],
  cartProductIds: number[],
): CatalogProductRow[] {
  const available = rows.filter(({ product }) => isProductAvailable(product))
  if (available.length === 0) return []

  const favSet = new Set(favoriteIds)
  const cartSet = new Set(cartProductIds)

  const tierFavorites = available.filter(({ product }) => favSet.has(product.id))
  const tierCart = available
    .filter(({ product }) => cartSet.has(product.id))
    .sort((a, b) => productPriceUsd(b.product) - productPriceUsd(a.product))

  const anchorCategoryIds = new Set<number>()
  for (const { product } of available) {
    if ((favSet.has(product.id) || cartSet.has(product.id)) && product.category_id != null) {
      anchorCategoryIds.add(product.category_id)
    }
  }

  const tierSimilar = available.filter(
    ({ product }) =>
      !favSet.has(product.id) &&
      !cartSet.has(product.id) &&
      product.category_id != null &&
      anchorCategoryIds.has(product.category_id),
  )

  const tierRest = available
    .filter(
      ({ product }) =>
        !favSet.has(product.id) &&
        !cartSet.has(product.id) &&
        (product.category_id == null || !anchorCategoryIds.has(product.category_id)),
    )
    .sort((a, b) => unitsSold(b.product) - unitsSold(a.product))

  const tiers = [tierFavorites, tierCart, tierSimilar, tierRest]
  const pointers = tiers.map(() => 0)
  const used = new Set<number>()
  const result: CatalogProductRow[] = []

  while (result.length < available.length) {
    let progress = false
    for (let t = 0; t < tiers.length; t++) {
      while (pointers[t] < tiers[t].length) {
        const row = tiers[t][pointers[t]++]
        if (used.has(row.product.id)) continue
        used.add(row.product.id)
        result.push(row)
        progress = true
        break
      }
    }
    if (!progress) break
  }

  return result
}

export function filterCatalogByCollection(
  rows: CatalogProductRow[],
  collection: StorefrontProductCollection | null,
  favoriteIds: number[],
  cartProductIds: number[] = [],
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
      return personalizedAvailableProducts(rows, favoriteIds, cartProductIds)
    default:
      return rows
  }
}

export function previewCollectionProducts(
  rows: CatalogProductRow[],
  collection: StorefrontProductCollection,
  favoriteIds: number[],
  cartProductIds: number[] = [],
  limit = COLLECTION_PREVIEW_COUNT,
): CatalogProductRow[] {
  return filterCatalogByCollection(rows, collection, favoriteIds, cartProductIds).slice(
    0,
    limit,
  )
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
