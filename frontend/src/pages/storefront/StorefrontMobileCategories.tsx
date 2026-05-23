import { ChevronLeft, LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { sortStorefrontCategories } from './storefrontCategoryCardTheme'
import { StorefrontSectionPanel } from './StorefrontSectionPanel'

type Props = {
  categories: PublicStorefrontCategory[]
  title: string
  productCountLabel: (n: number) => string
  viewAllLabel?: string
  onSelect: (id: number) => void
  onViewAll?: () => void
}

export function StorefrontMobileCategories({
  categories,
  title,
  productCountLabel,
  viewAllLabel,
  onSelect,
  onViewAll,
}: Props) {
  const { lang } = useLocale()
  const rows = sortStorefrontCategories(categories.filter((c) => c.products.length > 0))
  if (rows.length === 0 && !onViewAll) return null

  const useGrid = rows.length + (onViewAll ? 1 : 0) <= 8

  return (
    <StorefrontSectionPanel sectionKey="categories" title={title} className="mb-6 lg:mb-8">
      <div
        className={
          useGrid
            ? 'grid grid-cols-3 gap-2.5 min-[380px]:gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
            : 'sf-scrollbar-none -mx-0.5 flex gap-2.5 overflow-x-auto px-0.5 pb-0.5 min-[380px]:gap-3'
        }
      >
        {onViewAll && viewAllLabel ? (
          <button
            type="button"
            onClick={onViewAll}
            className={[
              'sf-section-cat-card group flex flex-col overflow-hidden rounded-2xl bg-white/95 text-start shadow-md ring-1 ring-white/50 transition duration-300',
              'hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]',
              useGrid ? 'min-w-0' : 'w-[7.5rem] shrink-0',
            ].join(' ')}
          >
            <div className="flex flex-1 flex-col p-2.5 pt-3">
              <div className="relative mx-auto flex aspect-square w-full max-w-[5.5rem] items-center justify-center overflow-hidden rounded-2xl bg-violet-50 p-2 ring-1 ring-violet-100">
                <LayoutGrid className="h-7 w-7 text-violet-600" aria-hidden />
              </div>
              <div className="mt-2.5 px-0.5 pb-0.5 text-center">
                <p className="line-clamp-2 text-[11px] font-extrabold leading-snug text-slate-900">
                  {viewAllLabel}
                </p>
              </div>
            </div>
          </button>
        ) : null}

        {rows.map((cat) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={[
                'sf-section-cat-card group flex flex-col overflow-hidden rounded-2xl bg-white/95 text-start shadow-md ring-1 ring-white/50 transition duration-300',
                'hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]',
                useGrid ? 'min-w-0' : 'w-[7.5rem] shrink-0',
              ].join(' ')}
            >
              <div className="relative flex flex-1 flex-col p-2.5 pt-3">
                <div className="relative mx-auto aspect-square w-full max-w-[5.5rem] overflow-hidden rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full rounded-xl object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-xl bg-violet-100 text-2xl font-black text-violet-700">
                      {label.charAt(0)}
                    </div>
                  )}
                  <span
                    className="absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 opacity-0 shadow-md transition group-hover:opacity-100"
                    aria-hidden
                  >
                    <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" />
                  </span>
                </div>

                <div className="mt-2.5 px-0.5 pb-0.5 text-center">
                  <p className="line-clamp-2 text-[11px] font-extrabold leading-snug text-slate-900">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                    {productCountLabel(count)}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </StorefrontSectionPanel>
  )
}
