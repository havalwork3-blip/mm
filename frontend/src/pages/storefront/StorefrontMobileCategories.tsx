import { ChevronLeft } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { categoryCardGradient, sortStorefrontCategories } from './storefrontCategoryCardTheme'

type Props = {
  categories: PublicStorefrontCategory[]
  accent: string
  title: string
  productCountLabel: (n: number) => string
  onSelect: (id: number) => void
}

export function StorefrontMobileCategories({
  categories,
  accent,
  title,
  productCountLabel,
  onSelect,
}: Props) {
  const { lang } = useLocale()
  const rows = sortStorefrontCategories(categories.filter((c) => c.products.length > 0))
  if (rows.length === 0) return null

  const useGrid = rows.length <= 4

  return (
    <div className="sf-mobile-categories mb-6 lg:hidden">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-5 w-1 rounded-full"
          style={{ background: `linear-gradient(180deg, ${accent}, ${accent}88)` }}
          aria-hidden
        />
        <h2 className="sf-heading text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
      </div>

      <div
        className={
          useGrid
            ? 'grid grid-cols-3 gap-2.5 min-[380px]:gap-3'
            : 'sf-scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-1'
        }
      >
        {rows.map((cat, index) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length
          const gradient = categoryCardGradient(cat, index)

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={[
                'sf-mobile-cat-card group relative flex flex-col overflow-hidden rounded-2xl text-start shadow-lg transition duration-300',
                'hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]',
                useGrid ? 'min-w-0' : 'w-[7.5rem] shrink-0',
              ].join(' ')}
              style={{ background: gradient }}
            >
              <span className="sf-mobile-cat-card-shine pointer-events-none absolute inset-0" aria-hidden />

              <div className="relative flex flex-1 flex-col p-2.5 pt-3">
                <div className="relative mx-auto aspect-square w-full max-w-[5.5rem] overflow-hidden rounded-2xl bg-white/25 p-1.5 shadow-inner ring-2 ring-white/35 backdrop-blur-sm">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full rounded-xl object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-white/20 text-2xl font-black text-white">
                      {label.charAt(0)}
                    </div>
                  )}
                  <span
                    className="absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-700 opacity-0 shadow-md transition group-hover:opacity-100"
                    aria-hidden
                  >
                    <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" />
                  </span>
                </div>

                <div className="mt-2.5 px-0.5 pb-0.5 text-center">
                  <p className="line-clamp-2 text-[11px] font-extrabold leading-snug text-white drop-shadow-sm">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-white/85">
                    {productCountLabel(count)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
