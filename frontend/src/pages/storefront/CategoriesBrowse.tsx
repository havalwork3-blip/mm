import { ChevronLeft, Layers } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { SF_INSET_X } from './storefrontTheme'

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
    pickCategory: string
    pickCategoryHint: string
    viewAllProducts: string
    productCount: string
    categories: string
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
    <section className={`${SF_INSET_X} mt-4 sm:mt-6`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Layers className="h-5 w-5" style={{ color: accent }} aria-hidden />
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{labels.categories}</h2>
          </div>
          <p className="text-sm text-slate-500">{labels.pickCategoryHint}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {categories.map((cat, index) => {
          const img = resolveMediaUrl(
            cat.image_url ?? cat.products.find((p) => p.image_url)?.image_url ?? null,
          )
          const count = cat.products.length
          const label = categoryDisplayName(cat, lang)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="group relative overflow-hidden rounded-2xl bg-white text-start shadow-md ring-1 ring-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
            >
              <div className="relative aspect-[5/4] w-full overflow-hidden sm:aspect-[4/3]">
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-4xl font-bold text-white"
                    style={{ background: GRADIENTS[index % GRADIENTS.length] }}
                  >
                    {label.charAt(0)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <p className="text-base font-bold leading-tight sm:text-lg">{label}</p>
                  <p className="mt-0.5 text-xs text-white/90">
                    {labels.productCount.replace('{n}', String(count))}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onViewAllProducts}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-4 text-sm font-bold transition hover:bg-white sm:text-base"
        style={{ borderColor: accent, color: accent }}
      >
        {labels.viewAllProducts}
        <ChevronLeft className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
      </button>
    </section>
  )
}
