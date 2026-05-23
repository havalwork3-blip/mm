import { ChevronLeft, LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { sortStorefrontCategories } from './storefrontCategoryCardTheme'
import { StorefrontSectionPanel } from './StorefrontSectionPanel'
import { SF_SECTION_CAT_WIDTH, SF_SECTION_SCROLL_ROW } from './storefrontTheme'

type Props = {
  categories: PublicStorefrontCategory[]
  title: string
  productCountLabel: (n: number) => string
  viewAllLabel?: string
  onSelect: (id: number) => void
  onViewAll?: () => void
}

const CAT_CARD =
  'sf-section-cat-card group flex flex-col overflow-hidden rounded-2xl bg-white text-start shadow-[0_4px_16px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.12)] active:scale-[0.98]'

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

  return (
    <StorefrontSectionPanel sectionKey="categories" title={title} className="mb-6 lg:mb-8">
      <div className={SF_SECTION_SCROLL_ROW}>
        {onViewAll && viewAllLabel ? (
          <button type="button" onClick={onViewAll} className={[CAT_CARD, SF_SECTION_CAT_WIDTH].join(' ')}>
            <div className="flex flex-1 flex-col p-2.5">
              <div className="relative mx-auto flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 ring-1 ring-violet-100/80">
                <LayoutGrid className="h-6 w-6 text-violet-600 sm:h-7 sm:w-7" aria-hidden />
              </div>
              <div className="mt-2 px-0.5 pb-1 text-center">
                <p className="line-clamp-2 text-[10px] font-extrabold leading-snug text-slate-800 sm:text-[11px]">
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
              className={[CAT_CARD, SF_SECTION_CAT_WIDTH].join(' ')}
            >
              <div className="relative flex flex-1 flex-col p-2.5">
                <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white p-1.5 ring-1 ring-slate-100">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full rounded-lg object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-lg bg-violet-100 text-xl font-black text-violet-700 sm:text-2xl">
                      {label.charAt(0)}
                    </div>
                  )}
                  <span
                    className="absolute -end-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-600 opacity-0 shadow-md transition group-hover:opacity-100 sm:h-6 sm:w-6"
                    aria-hidden
                  >
                    <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" />
                  </span>
                </div>

                <div className="mt-2 px-0.5 pb-1 text-center">
                  <p className="line-clamp-2 text-[10px] font-extrabold leading-snug text-slate-800 sm:text-[11px]">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold text-slate-500 sm:text-[10px]">
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
