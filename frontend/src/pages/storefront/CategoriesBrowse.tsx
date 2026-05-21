import { ChevronLeft, Sparkles } from 'lucide-react'

import type { PublicStorefrontCategory, StorefrontProductCollection } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import {
  COLLECTION_ICONS,
  StorefrontCollectionsGrid,
  type CollectionTile,
} from './StorefrontCollectionsGrid'
import { accentAlpha, SF_INSET_X } from './storefrontTheme'

const GRADIENTS = [
  'linear-gradient(145deg, #ff5a00 0%, #ff8c42 100%)',
  'linear-gradient(145deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(145deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(145deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(145deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(145deg, #14b8a6 0%, #2dd4bf 100%)',
]

type Props = {
  categories: PublicStorefrontCategory[]
  accent: string
  labels: {
    pickCategoryHint: string
    viewAllProducts: string
    productCount: string
    categories: string
    shopCategories: string
    shopHighlights: string
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
  }
  onSelectCategory: (id: number) => void
  onSelectCollection: (id: StorefrontProductCollection) => void
  onViewAllProducts: () => void
}

export function CategoriesBrowse({
  categories,
  accent,
  labels,
  onSelectCategory,
  onSelectCollection,
  onViewAllProducts,
}: Props) {
  const { lang } = useLocale()

  const collectionTiles: CollectionTile[] = [
    {
      id: 'bestsellers',
      title: labels.bestsellers,
      hint: labels.bestsellersHint,
      icon: COLLECTION_ICONS.bestsellers,
      gradient: 'linear-gradient(145deg, #f97316 0%, #ea580c 55%, #9a3412 100%)',
    },
    {
      id: 'new_arrivals',
      title: labels.newArrivals,
      hint: labels.newArrivalsHint,
      icon: COLLECTION_ICONS.new_arrivals,
      gradient: 'linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #4c1d95 100%)',
    },
    {
      id: 'on_sale',
      title: labels.onSale,
      hint: labels.onSaleHint,
      icon: COLLECTION_ICONS.on_sale,
      gradient: 'linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)',
    },
    {
      id: 'available_now',
      title: labels.availableNow,
      hint: labels.availableNowHint,
      icon: COLLECTION_ICONS.available_now,
      gradient: 'linear-gradient(145deg, #3b82f6 0%, #2563eb 55%, #1e3a8a 100%)',
    },
    {
      id: 'favorites',
      title: labels.myFavorites,
      hint: labels.myFavoritesHint,
      icon: COLLECTION_ICONS.favorites,
      gradient: 'linear-gradient(145deg, #ec4899 0%, #db2777 55%, #9d174d 100%)',
    },
  ]

  return (
    <section className={`${SF_INSET_X} sf-view-panel mt-2 sm:mt-4`}>
      <div
        className="mb-6 overflow-hidden rounded-3xl p-5 text-white sm:p-7"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}bb 50%, #1e293b 100%)`,
          boxShadow: `0 16px 48px ${accentAlpha(accent, 0.28)}`,
        }}
      >
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{labels.shopCategories}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{labels.pickCategoryHint}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 min-[420px]:grid-cols-3 sm:gap-4 md:gap-5">
        {categories.filter((cat) => cat.products.length > 0).map((cat, index, arr) => {
          const img = resolveMediaUrl(cat.image_url)
          const count = cat.products.length
          const label = categoryDisplayName(cat, lang)
          const featured = index === 0 && arr.length > 2

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'sf-cat-card sf-card-shine group relative overflow-hidden rounded-3xl text-start shadow-lg ring-1 ring-white/20 transition duration-300',
                'hover:-translate-y-1.5 hover:shadow-2xl active:scale-[0.98]',
                featured ? 'col-span-2 min-[420px]:col-span-2' : '',
              ].join(' ')}
            >
              <div
                className={[
                  'relative w-full overflow-hidden',
                  featured ? 'aspect-[2.2/1] min-h-[130px]' : 'aspect-[4/5] sm:aspect-[5/4]',
                ].join(' ')}
              >
                {img ? (
                  <img
                    src={img}
                    alt={label}
                    className="h-full w-full object-cover object-center transition duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-5xl font-black text-white/90"
                    style={{ background: GRADIENTS[index % GRADIENTS.length] }}
                  >
                    {label.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p
                    className={
                      featured
                        ? 'text-xl font-extrabold text-white sm:text-2xl'
                        : 'text-[15px] font-bold text-white sm:text-base'
                    }
                  >
                    {label}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-white/80">
                    {labels.productCount.replace('{n}', String(count))}
                  </p>
                </div>
                <span
                  className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-md transition group-hover:bg-white/40"
                  aria-hidden
                >
                  <ChevronLeft className="h-4 w-4 rotate-180 rtl:rotate-0" />
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <p className="sf-sidebar-muted mt-8 mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {labels.shopHighlights}
      </p>
      <StorefrontCollectionsGrid
        accent={accent}
        tiles={collectionTiles}
        viewAllLabel={labels.viewAllProducts}
        onSelectCollection={onSelectCollection}
        onViewAllProducts={onViewAllProducts}
      />
    </section>
  )
}
