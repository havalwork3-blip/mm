import { ChevronLeft, LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import {
  categoriesUseClassicPanel,
  resolveCategoriesSectionGradient,
  sortStorefrontCategories,
} from './storefrontCategoryCardTheme'
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

const CAT_BTN =
  'sf-section-cat-card group flex flex-col items-stretch text-start transition duration-300 active:scale-[0.98]'

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

  const classic = categoriesUseClassicPanel(rows)
  const customGradient = resolveCategoriesSectionGradient(categories)

  return (
    <StorefrontSectionPanel
      sectionKey="categories"
      title={title}
      appearance={classic ? 'classic' : 'blend'}
      backgroundGradient={customGradient}
    >
      <div className={SF_SECTION_SCROLL_ROW}>
        {onViewAll && viewAllLabel ? (
          <button type="button" onClick={onViewAll} className={[CAT_BTN, SF_SECTION_CAT_WIDTH].join(' ')}>
            <div className="sf-section-cat-media">
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-violet-50">
                <LayoutGrid className="h-6 w-6 text-violet-600 sm:h-7 sm:w-7" aria-hidden />
              </div>
            </div>
            <div className="sf-section-cat-label">
              <p className="line-clamp-2 text-[10px] font-extrabold leading-snug text-slate-700 sm:text-[11px]">
                {viewAllLabel}
              </p>
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
              className={[CAT_BTN, SF_SECTION_CAT_WIDTH].join(' ')}
            >
              <div className="sf-section-cat-media">
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-b from-slate-50 to-white">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-violet-100 text-xl font-black text-violet-700 sm:text-2xl">
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
              </div>

              <div className="sf-section-cat-label">
                <p className="line-clamp-2 text-[10px] font-extrabold leading-snug text-slate-700 sm:text-[11px]">
                  {label}
                </p>
                <p className="mt-0.5 text-[9px] font-semibold text-slate-500 sm:text-[10px]">
                  {productCountLabel(count)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </StorefrontSectionPanel>
  )
}
