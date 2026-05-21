import { ArrowLeft, BadgePercent, Flame, PackageCheck, Sparkles } from 'lucide-react'
import { useMemo } from 'react'

import type { PublicStorefrontProduct, StorefrontProductCollection } from '../../api/storefrontApi'
import {
  COLLECTION_PREVIEW_COUNT,
  previewCollectionProducts,
  STOREFRONT_HOME_COLLECTIONS,
  type CatalogProductRow,
} from './storefrontCollections'
import { StorefrontProductCardCompact } from './StorefrontProductCardCompact'
import { accentAlpha } from './storefrontTheme'

const COLLECTION_META = {
  bestsellers: { icon: Flame, titleKey: 'bestsellers' as const, hintKey: 'bestsellersHint' as const },
  new_arrivals: { icon: Sparkles, titleKey: 'newArrivals' as const, hintKey: 'newArrivalsHint' as const },
  on_sale: { icon: BadgePercent, titleKey: 'onSale' as const, hintKey: 'onSaleHint' as const },
  available_now: {
    icon: PackageCheck,
    titleKey: 'availableNow' as const,
    hintKey: 'availableNowHint' as const,
  },
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
  addToFavorites: string
  removeFromFavorites: string
}

type Props = {
  shopId: number
  accent: string
  catalogRows: CatalogProductRow[]
  favoriteIds: number[]
  cartProductIds: number[]
  qtyInCart: (productId: number) => number
  onAddToCart: (product: PublicStorefrontProduct) => void
  labels: CollectionLabels & { addToCart: string }
  onSelectCollection: (id: StorefrontProductCollection) => void
  onOpenProduct: (product: PublicStorefrontProduct, categoryName: string) => void
  onViewAllProducts: () => void
}

export function StorefrontCollectionSections({
  shopId,
  accent,
  catalogRows,
  favoriteIds,
  cartProductIds,
  qtyInCart,
  onAddToCart,
  labels,
  onSelectCollection,
  onOpenProduct,
  onViewAllProducts,
}: Props) {
  const sections = useMemo(() => {
    return STOREFRONT_HOME_COLLECTIONS.map((id) => {
      const all = previewCollectionProducts(catalogRows, id, favoriteIds, cartProductIds, 9999)
      const preview = all.slice(0, COLLECTION_PREVIEW_COUNT)
      return { id, allCount: all.length, preview }
    }).filter((s) => s.allCount > 0)
  }, [catalogRows, favoriteIds, cartProductIds])

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
        return (
          <section
            key={id}
            className="sf-collection-section overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70 sm:p-5"
          >
            <div className="mb-3.5 flex items-center gap-3 lg:mb-4">
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
                <h3 className="sf-heading truncate text-[15px] font-extrabold text-slate-900 sm:text-base lg:text-lg">
                  {title}
                </h3>
                <p className="truncate text-[11px] font-medium text-slate-500 lg:text-xs">{hint}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCollection(id)}
                className="hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition hover:brightness-95 lg:inline-flex"
                style={{
                  backgroundColor: accentAlpha(accent, 0.1),
                  color: accent,
                }}
              >
                {labels.viewAll}
                <ArrowLeft className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
              </button>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold lg:hidden"
                style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
              >
                {allCount}
              </span>
            </div>

            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:flex lg:gap-4 lg:overflow-x-auto lg:pb-2 lg:snap-x lg:snap-mandatory sf-scrollbar-none">
              {preview.map(({ product, categoryName }) => (
                <StorefrontProductCardCompact
                  key={product.id}
                  shopId={shopId}
                  product={product}
                  accent={accent}
                  inCart={qtyInCart(product.id)}
                  onOpen={() => onOpenProduct(product, categoryName)}
                  onAddToCart={() => onAddToCart(product)}
                  addToCart={labels.addToCart}
                  addToFavorites={labels.addToFavorites}
                  removeFromFavorites={labels.removeFromFavorites}
                  className="lg:w-[11.5rem] lg:shrink-0 lg:snap-start"
                />
              ))}
            </ul>

            {allCount > 0 ? (
              <button
                type="button"
                onClick={() => onSelectCollection(id)}
                className="sf-view-all-link mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition active:scale-[0.99] lg:hidden"
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
