import {
  ArrowLeft,
  BadgePercent,
  Flame,
  Heart,
  PackageCheck,
  Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'

import type { PublicStorefrontProduct, StorefrontProductCollection } from '../../api/storefrontApi'
import {
  COLLECTION_PREVIEW_COUNT,
  previewCollectionProducts,
  STOREFRONT_COLLECTION_ORDER,
  type CatalogProductRow,
} from './storefrontCollections'
import { StorefrontProductCardCompact } from './StorefrontProductCardCompact'
import { accentAlpha } from './storefrontTheme'

const COLLECTION_META: Record<
  StorefrontProductCollection,
  { icon: typeof Flame; titleKey: keyof CollectionLabels; hintKey: keyof CollectionLabels }
> = {
  bestsellers: { icon: Flame, titleKey: 'bestsellers', hintKey: 'bestsellersHint' },
  new_arrivals: { icon: Sparkles, titleKey: 'newArrivals', hintKey: 'newArrivalsHint' },
  on_sale: { icon: BadgePercent, titleKey: 'onSale', hintKey: 'onSaleHint' },
  available_now: { icon: PackageCheck, titleKey: 'availableNow', hintKey: 'availableNowHint' },
  favorites: { icon: Heart, titleKey: 'myFavorites', hintKey: 'myFavoritesHint' },
}

type CollectionLabels = {
  shopHighlights: string
  viewAll: string
  viewAllProducts: string
  bestsellers: string
  bestsellersHint: string
  newArrivals: string
  newArrivalsHint: string
  onSale: string
  onSaleHint: string
  availableNow: string
  availableNowHint: string
  myFavorites: string
  myFavoritesHint: string
  favoritesEmpty: string
  favoritesEmptyHint: string
  addToFavorites: string
  removeFromFavorites: string
}

type Props = {
  shopId: number
  accent: string
  catalogRows: CatalogProductRow[]
  favoriteIds: number[]
  labels: CollectionLabels
  onSelectCollection: (id: StorefrontProductCollection) => void
  onOpenProduct: (product: PublicStorefrontProduct, categoryName: string) => void
  onViewAllProducts: () => void
}

export function StorefrontCollectionSections({
  shopId,
  accent,
  catalogRows,
  favoriteIds,
  labels,
  onSelectCollection,
  onOpenProduct,
  onViewAllProducts,
}: Props) {
  const sections = useMemo(() => {
    return STOREFRONT_COLLECTION_ORDER.map((id) => {
      const all = previewCollectionProducts(catalogRows, id, favoriteIds, 9999)
      const preview = all.slice(0, COLLECTION_PREVIEW_COUNT)
      return { id, allCount: all.length, preview }
    }).filter((s) => s.id === 'favorites' || s.allCount > 0)
  }, [catalogRows, favoriteIds])

  if (sections.length === 0) return null

  return (
    <div className="sf-collections mt-10 space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="sf-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            {labels.shopHighlights}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">{labels.bestsellersHint}</p>
        </div>
      </div>

      {sections.map(({ id, allCount, preview }) => {
        const meta = COLLECTION_META[id]
        const Icon = meta.icon
        const title = labels[meta.titleKey]
        const hint = labels[meta.hintKey]
        const isFavorites = id === 'favorites'

        return (
          <section
            key={id}
            className="sf-collection-section overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5"
          >
            <div className="mb-3.5 flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                style={{
                  backgroundColor: accentAlpha(accent, 0.12),
                  color: accent,
                }}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="sf-heading truncate text-[15px] font-extrabold text-slate-900 sm:text-base">
                  {title}
                </h3>
                <p className="truncate text-[11px] font-medium text-slate-500">{hint}</p>
              </div>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
              >
                {allCount}
              </span>
            </div>

            {isFavorites && preview.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-50 px-4 py-10 text-center">
                <Heart className="h-8 w-8 text-slate-300" aria-hidden />
                <p className="text-sm font-bold text-slate-700">{labels.favoritesEmpty}</p>
                <p className="max-w-xs text-xs text-slate-500">{labels.favoritesEmptyHint}</p>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
                {preview.map(({ product, categoryName }) => (
                  <StorefrontProductCardCompact
                    key={product.id}
                    shopId={shopId}
                    product={product}
                    accent={accent}
                    onOpen={() => onOpenProduct(product, categoryName)}
                    addToFavorites={labels.addToFavorites}
                    removeFromFavorites={labels.removeFromFavorites}
                  />
                ))}
              </ul>
            )}

            {allCount > 0 && !(isFavorites && preview.length === 0) ? (
              <button
                type="button"
                onClick={() => onSelectCollection(id)}
                className="sf-view-all-link mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-[0.99]"
                style={{
                  backgroundColor: accentAlpha(accent, 0.08),
                  color: accent,
                }}
              >
                {labels.viewAll}
                <ArrowLeft className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
              </button>
            ) : null}
          </section>
        )
      })}

      <button
        type="button"
        onClick={onViewAllProducts}
        className="flex w-full items-center justify-center gap-2.5 rounded-3xl py-4 text-[15px] font-extrabold text-white shadow-lg transition hover:brightness-105 active:scale-[0.99]"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 12px 32px ${accentAlpha(accent, 0.32)}`,
        }}
      >
        {labels.viewAllProducts}
        <ArrowLeft className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
      </button>
    </div>
  )
}
