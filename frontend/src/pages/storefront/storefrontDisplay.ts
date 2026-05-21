import type { PublicStorefrontAppearance } from '../../api/storefrontApi'
import type { StorefrontProductCollection } from '../../api/storefrontApi'
import type { StorefrontStrings } from './storefrontStrings'

export function storefrontHeaderTitle(
  appearance: PublicStorefrontAppearance,
  shopLegalName: string,
): string | null {
  const custom = (appearance.catalog_title ?? '').trim()
  if (custom) return custom
  if (appearance.header_show_shop_name) {
    const name = shopLegalName.trim()
    if (name) return name
  }
  return null
}

export function storefrontHeaderSubtitle(appearance: PublicStorefrontAppearance): string | null {
  const sub = (appearance.catalog_subtitle ?? '').trim()
  return sub || null
}

export function storefrontHomeCategoriesTitle(
  appearance: PublicStorefrontAppearance,
  fallback: string,
): string {
  return (appearance.home_categories_title ?? '').trim() || fallback
}

export function storefrontHomeHighlightsTitle(
  appearance: PublicStorefrontAppearance,
  fallback: string,
): string {
  return (appearance.home_highlights_title ?? '').trim() || fallback
}

export function storefrontCollectionLabel(
  appearance: PublicStorefrontAppearance,
  s: StorefrontStrings,
  collection: StorefrontProductCollection,
): string {
  const custom = appearance.home_collection_titles?.[collection]
  if (custom?.trim()) return custom.trim()
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
      return ''
  }
}
