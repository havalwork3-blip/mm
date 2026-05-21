import {
  ArrowLeft,
  BadgePercent,
  Clock,
  Crown,
  Flame,
  PackageCheck,
  Sparkles,
  Tag,
  Wallet,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'

import type { PublicStorefrontProduct, StorefrontProductCollection } from '../../api/storefrontApi'
import {
  COLLECTION_PREVIEW_COUNT,
  previewCollectionProducts,
  STOREFRONT_HOME_COLLECTIONS,
  type CatalogProductRow,
  type StorefrontHomeCollection,
} from './storefrontCollections'
import { StorefrontProductCardCompact } from './StorefrontProductCardCompact'
import { accentAlpha } from './storefrontTheme'

const COLLECTION_META: Record<
  StorefrontHomeCollection,
  {
    icon: typeof Flame
    titleKey: keyof CollectionLabels
    hintKey: keyof CollectionLabels
    tint: string
  }
> = {
  bestsellers: { icon: Flame, titleKey: 'bestsellers', hintKey: 'bestsellersHint', tint: '#f97316' },
  best_deals: { icon: Zap, titleKey: 'bestDeals', hintKey: 'bestDealsHint', tint: '#eab308' },
  on_sale: { icon: BadgePercent, titleKey: 'onSale', hintKey: 'onSaleHint', tint: '#10b981' },
  new_arrivals: { icon: Sparkles, titleKey: 'newArrivals', hintKey: 'newArrivalsHint', tint: '#8b5cf6' },
  budget_picks: { icon: Wallet, titleKey: 'budgetPicks', hintKey: 'budgetPicksHint', tint: '#06b6d4' },
  available_now: {
    icon: PackageCheck,
    titleKey: 'availableNow',
    hintKey: 'availableNowHint',
    tint: '#3b82f6',
  },
  premium: { icon: Crown, titleKey: 'premium', hintKey: 'premiumHint', tint: '#a855f7' },
  recently_viewed: {
    icon: Clock,
    titleKey: 'recentlyViewed',
    hintKey: 'recentlyViewedHint',
    tint: '#64748b',
  },
}

export type CollectionLabels = {
  shopHighlights: string
  shopHighlightsSubtitle: string
  viewAll: string
  viewAllProducts: string
  bestsellers: string
  bestsellersHint: string
  bestDeals: string
  bestDealsHint: string
  newArrivals: string
  newArrivalsHint: string
  onSale: string
  onSaleHint: string
  budgetPicks: string
  budgetPicksHint: string
  premium: string
  premiumHint: string
  availableNow: string
  availableNowHint: string
  recentlyViewed: string
  recentlyViewedHint: string
  addToFavorites: string
  removeFromFavorites: string
}

type Props = {
  shopId: number
  accent: string
  catalogRows: CatalogProductRow[]
  favoriteIds: number[]
  recentIds: number[]
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
  recentIds,
  labels,
  onSelectCollection,
  onOpenProduct,
  onViewAllProducts,
}: Props) {
  const sections = useMemo(() => {
    return STOREFRONT_HOME_COLLECTIONS.map((id) => {
      const all = previewCollectionProducts(catalogRows, id, favoriteIds, recentIds, 9999)
      const preview = all.slice(0, COLLECTION_PREVIEW_COUNT)
      return { id, allCount: all.length, preview }
    }).filter((s) => s.allCount > 0)
  }, [catalogRows, favoriteIds, recentIds])

  if (sections.length === 0) return null

  return (
    <div className="sf-collections mt-10 space-y-5">
      <div
        className="sf-highlights-hero overflow-hidden rounded-3xl p-5 sm:p-6"
        style={{
          background: `linear-gradient(135deg, ${accentAlpha(accent, 0.14)} 0%, ${accentAlpha(accent, 0.04)} 55%, transparent 100%)`,
          boxShadow: `inset 0 0 0 1px ${accentAlpha(accent, 0.12)}`,
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
          >
            <Tag className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="sf-heading text-lg font-extrabold tracking-tight sm:text-xl">
              {labels.shopHighlights}
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 sm:text-sm">
              {labels.shopHighlightsSubtitle}
            </p>
          </div>
        </div>

        <div className="sf-collection-chips mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map(({ id, allCount }) => {
            const meta = COLLECTION_META[id]
            const Icon = meta.icon
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectCollection(id)}
                className="flex shrink-0 items-center gap-2 rounded-full bg-white py-2 ps-2 pe-3.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-md active:scale-[0.98]"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: meta.tint }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                {labels[meta.titleKey]}
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
                  style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
                >
                  {allCount}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-5">
        {sections.map(({ id, allCount, preview }, index) => {
          const meta = COLLECTION_META[id]
          const Icon = meta.icon
          const title = labels[meta.titleKey]
          const hint = labels[meta.hintKey]
          const featured = index === 0

          return (
            <section
              key={id}
              className={[
                'sf-collection-section overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70',
                featured ? 'p-4 sm:p-5' : 'p-3.5 sm:p-4',
              ].join(' ')}
              style={{
                borderInlineStartWidth: '4px',
                borderInlineStartColor: meta.tint,
              }}
            >
              <div className="mb-3.5 flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ background: `linear-gradient(145deg, ${meta.tint}, ${meta.tint}cc)` }}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="sf-heading truncate text-[15px] font-extrabold sm:text-base">
                    {title}
                  </h3>
                  <p className="truncate text-[11px] font-medium text-slate-500">{hint}</p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: meta.tint }}
                >
                  {allCount}
                </span>
              </div>

              <ul
                className={[
                  'grid gap-2.5 sm:gap-3',
                  featured ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4',
                ].join(' ')}
              >
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
            </section>
          )
        })}
      </div>

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
