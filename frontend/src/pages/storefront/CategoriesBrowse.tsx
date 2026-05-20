import { ArrowLeft, ChevronLeft, Sparkles } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
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
  }
  onSelectCategory: (id: number) => void
  onViewAllProducts: () => void
}

export function CategoriesBrowse({
  categories,
  accent,
  labels,
  onSelectCategory,
  onViewAllProducts,
}: Props) {
  const { lang } = useLocale()

  return (
    <section className={`${SF_INSET_X} sf-view-panel mt-4 sm:mt-6`}>
      <div
        className="mb-5 overflow-hidden rounded-3xl p-5 text-white shadow-lg sm:p-6"
        style={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 45%, #1e293b 100%)`,
          boxShadow: `0 12px 40px ${accentAlpha(accent, 0.35)}`,
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">{labels.shopCategories}</h2>
            <p className="mt-1 text-sm text-white/90">{labels.pickCategoryHint}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat, index) => {
          const img = resolveMediaUrl(
            cat.image_url ?? cat.products.find((p) => p.image_url)?.image_url ?? null,
          )
          const count = cat.products.length
          const label = categoryDisplayName(cat, lang)
          const featured = index === 0 && categories.length > 2

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={[
                'sf-cat-card group relative overflow-hidden rounded-3xl text-start shadow-md ring-1 ring-black/5 transition duration-300',
                'hover:-translate-y-1 hover:shadow-2xl active:scale-[0.98]',
                featured ? 'col-span-2 row-span-1 min-[420px]:col-span-2' : '',
              ].join(' ')}
            >
              <div
                className={[
                  'relative w-full overflow-hidden',
                  featured ? 'aspect-[2.1/1] min-h-[120px]' : 'aspect-[4/5] sm:aspect-[5/4]',
                ].join(' ')}
              >
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className={featured ? 'text-xl font-extrabold text-white' : 'text-base font-bold text-white sm:text-lg'}>
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-white/85">
                    {labels.productCount.replace('{n}', String(count))}
                  </p>
                </div>
                <span
                  className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition group-hover:bg-white/35"
                  aria-hidden
                >
                  <ChevronLeft className="h-4 w-4 rotate-180 rtl:rotate-0" />
                </span>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onViewAllProducts}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-white shadow-lg transition hover:brightness-105 active:scale-[0.99] sm:text-base"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 8px 28px ${accentAlpha(accent, 0.4)}`,
        }}
      >
        {labels.viewAllProducts}
        <ArrowLeft className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
      </button>
    </section>
  )
}
