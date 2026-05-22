import { ArrowLeft, BadgePercent, Flame, PackageCheck, Sparkles } from 'lucide-react'
import { useMemo } from 'react'

import { useMediaQuery } from '../../hooks/useMediaQuery'
import type { PublicStorefrontProduct, StorefrontProductCollection } from '../../api/storefrontApi'
import {
  COLLECTION_PREVIEW_COUNT,
  previewCollectionProducts,
  STOREFRONT_HOME_COLLECTIONS,
  type CatalogProductRow,
} from './storefrontCollections'
import { StorefrontProductCardCompact } from './StorefrontProductCardCompact'
import { accentAlpha, SF_COLLECTION_GRID } from './storefrontTheme'

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

function useCollectionPreviewCount(): number {
  const isLg = useMediaQuery('(min-width: 1024px)')
  const isMd = useMediaQuery('(min-width: 768px)')
  if (isLg) return 8
  if (isMd) return 6
  return COLLECTION_PREVIEW_COUNT
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
  const previewCount = useCollectionPreviewCount()

  const sections = useMemo(() => {
    return STOREFRONT_HOME_COLLECTIONS.map((id) => {
      const all = previewCollectionProducts(catalogRows, id, favoriteIds, cartProductIds, 9999)
      const preview = all.slice(0, previewCount)
      return { id, allCount: all.length, preview }
    }).filter((s) => s.allCount > 0)
  }, [catalogRows, favoriteIds, cartProductIds, previewCount])

  if (sections.length === 0) return null

  return (
    <div className="sf-collections mt-2 space-y-7 sm:space-y-8 lg:space-y-6">
      <div className="flex items-center gap-2 px-0.5 lg:px-0">
        <span
          className="h-7 w-1 rounded-full lg:h-8"
          style={{ background: `linear-gradient(180deg, ${accent}, ${accent}88)` }}
          aria-hidden
        />
        <div>
          <h2 className="sf-heading text-base font-extrabold tracking-tight text-slate-900 sm:text-lg lg:text-xl">
            {labels.shopHighlights}
          </h2>
          <p className="text-[11px] font-medium text-slate-500 lg:text-xs">{labels.bestsellersHint}</p>
        </div>
      </div>

      {sections.map(({ id, allCount, preview }) => {
        const meta = COLLECTION_META[id]
        const Icon = meta.icon
        const title = labels[meta.titleKey]
        const hint = labels[meta.hintKey]
        return (
          <section key={id} className="sf-collection-section">
            <div className="mb-3 flex items-center gap-3 lg:mb-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl lg:h-11 lg:w-11 lg:rounded-2xl"
                style={{
                  background: `linear-gradient(135deg, ${accentAlpha(accent, 0.14)}, ${accentAlpha(accent, 0.06)})`,
                  color: accent,
                  boxShadow: `0 4px 14px ${accentAlpha(accent, 0.12)}`,
                }}
              >
                <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="sf-heading truncate text-[15px] font-extrabold text-slate-900 sm:text-base lg:text-lg">
                  {title}
                </h3>
                <p className="truncate text-[10px] font-medium text-slate-500 sm:text-[11px] lg:text-xs">
                  {hint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelectCollection(id)}
                className="hidden shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition hover:brightness-95 md:inline-flex lg:text-sm"
                style={{
                  backgroundColor: accentAlpha(accent, 0.1),
                  color: accent,
                }}
              >
                {labels.viewAll}
                <ArrowLeft className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" aria-hidden />
              </button>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold md:hidden"
                style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
              >
                {allCount}
              </span>
            </div>

            <ul className={SF_COLLECTION_GRID}>
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
                />
              ))}
            </ul>

            {allCount > preview.length ? (
              <button
                type="button"
                onClick={() => onSelectCollection(id)}
                className="sf-view-all-link mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-bold transition active:scale-[0.99] md:hidden"
                style={{
                  borderColor: accentAlpha(accent, 0.22),
                  backgroundColor: accentAlpha(accent, 0.06),
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
        className="sf-cta-all mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-105 active:scale-[0.99] sm:py-4 sm:text-[15px] lg:max-w-lg lg:rounded-2xl lg:py-4"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 10px 28px ${accentAlpha(accent, 0.28)}`,
        }}
      >
        {labels.viewAllProducts}
        <ArrowLeft className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
      </button>
    </div>
  )
}
