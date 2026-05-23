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
import { StorefrontSectionPanel } from './StorefrontSectionPanel'
import type { StorefrontSectionKey } from './storefrontSectionTheme'
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

const COLLECTION_SECTION_KEY = {
  bestsellers: 'bestsellers',
  new_arrivals: 'new_arrivals',
  on_sale: 'on_sale',
  available_now: 'available_now',
} as const satisfies Record<(typeof STOREFRONT_HOME_COLLECTIONS)[number], StorefrontSectionKey>

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
    <div className="sf-collections mt-2 space-y-6 sm:space-y-7 lg:space-y-8">
      {sections.map(({ id, allCount, preview }) => {
        const meta = COLLECTION_META[id]
        const Icon = meta.icon
        const title = labels[meta.titleKey]
        const hint = labels[meta.hintKey]
        const sectionKey = COLLECTION_SECTION_KEY[id]

        const viewAllBtn = (
          <button
            type="button"
            onClick={() => onSelectCollection(id)}
            className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition hover:bg-white/30 sm:text-xs"
          >
            {labels.viewAll}
            <ArrowLeft className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" aria-hidden />
          </button>
        )

        return (
          <StorefrontSectionPanel
            key={id}
            sectionKey={sectionKey}
            title={
              <span className="inline-flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 opacity-90 sm:h-5 sm:w-5" aria-hidden />
                {title}
              </span>
            }
            subtitle={hint}
            headerAside={viewAllBtn}
          >
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
                className="sf-view-all-link mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/15 py-2.5 text-sm font-bold text-white transition hover:bg-white/25 active:scale-[0.99] md:hidden"
              >
                {labels.viewAll}
                <ArrowLeft className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
              </button>
            ) : null}
          </StorefrontSectionPanel>
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
