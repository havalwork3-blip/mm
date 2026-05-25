import { ChevronLeft } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import {
  categoriesUseClassicPanel,
  categoryCardGradient,
  resolveCategoriesSectionGradient,
  sortStorefrontCategories,
} from './storefrontCategoryCardTheme'
import { StorefrontSectionPanel } from './StorefrontSectionPanel'
import { SF_CATEGORY_GRID } from './storefrontTheme'

type Props = {
  categories: PublicStorefrontCategory[]
  title: string
  subtitle?: string
  productCountLabel: (n: number) => string
  onSelect: (id: number) => void
}

export function StorefrontMobileCategories({
  categories,
  title,
  subtitle,
  productCountLabel,
  onSelect,
}: Props) {
  const { lang } = useLocale()
  const rows = sortStorefrontCategories(categories.filter((c) => c.products.length > 0))
  if (rows.length === 0) return null

  const classic = categoriesUseClassicPanel(rows)
  const customGradient = resolveCategoriesSectionGradient(categories)
  const spanLastAlone = rows.length % 2 === 1 && rows.length > 1

  return (
    <StorefrontSectionPanel
      sectionKey="categories"
      title={title}
      subtitle={subtitle}
      appearance={classic ? 'classic' : 'blend'}
      backgroundGradient={customGradient}
    >
      <ul className={SF_CATEGORY_GRID}>
        {rows.map((cat, index) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length
          const cardBg = categoryCardGradient(cat, index)
          const isLastOdd = spanLastAlone && index === rows.length - 1

          return (
            <li
              key={cat.id}
              className={isLastOdd ? 'col-span-2 sm:col-span-1' : undefined}
            >
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className={[
                  'sf-category-feature-card group relative flex w-full flex-col overflow-hidden rounded-2xl text-start',
                  'transition duration-300 active:scale-[0.98]',
                  isLastOdd ? 'sm:min-h-[10.5rem]' : 'min-h-[9.5rem] sm:min-h-[10.5rem]',
                ].join(' ')}
                style={{ background: cardBg }}
              >
                <span
                  className="sf-mobile-cat-card-shine pointer-events-none absolute inset-0"
                  aria-hidden
                />

                <div className="relative flex flex-1 flex-col p-3 sm:p-3.5">
                  <div className="sf-category-feature-media relative mx-auto w-full max-w-[8.5rem] shrink-0 sm:max-w-[9.5rem]">
                    <div className="aspect-square overflow-hidden rounded-xl bg-white/20 p-1.5 shadow-lg ring-2 ring-white/35 backdrop-blur-[2px]">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-full w-full rounded-lg object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/25 text-2xl font-black text-white sm:text-3xl">
                          {label.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="sf-category-feature-footer relative mt-auto pt-3">
                    <p className="line-clamp-2 text-center text-[12px] font-extrabold leading-snug text-white drop-shadow-md sm:text-[13px]">
                      {label}
                    </p>
                    <p className="mt-1.5 flex justify-center">
                      <span className="inline-flex rounded-full bg-white/22 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm ring-1 ring-white/30 sm:text-[11px]">
                        {productCountLabel(count)}
                      </span>
                    </p>
                  </div>
                </div>

                <span
                  className="absolute end-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white opacity-0 shadow-md backdrop-blur-sm transition group-hover:opacity-100 sm:end-3 sm:top-3"
                  aria-hidden
                >
                  <ChevronLeft className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </StorefrontSectionPanel>
  )
}
