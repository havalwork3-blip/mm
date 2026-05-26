import { LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { sortStorefrontCategories } from './storefrontCategoryCardTheme'
import { accentAlpha } from './storefrontTheme'

type Props = {
  categories: PublicStorefrontCategory[]
  title: string
  subtitle?: string
  accent: string
  productCountLabel: (n: number) => string
  onSelect: (id: number) => void
}

type BentoSize = 'hero' | 'wide' | 'tile'

function bentoLayout(index: number, total: number): { span: string; size: BentoSize } {
  if (total === 1) return { span: 'col-span-4', size: 'hero' }
  if (total === 2) return { span: 'col-span-2', size: 'wide' }
  if (total === 3) {
    if (index < 2) return { span: 'col-span-2', size: 'wide' }
    return { span: 'col-span-4', size: 'hero' }
  }
  if (index < 2) return { span: 'col-span-2', size: 'wide' }
  return { span: 'col-span-1', size: 'tile' }
}

export function StorefrontMobileCategories({
  categories,
  title,
  subtitle,
  accent,
  productCountLabel,
  onSelect,
}: Props) {
  const { lang } = useLocale()
  const rows = sortStorefrontCategories(categories.filter((c) => c.products.length > 0))
  if (rows.length === 0) return null

  const total = rows.length

  return (
    <section className="sf-shop-categories">
      <header className="sf-shop-categories-header mb-3 sm:mb-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-slate-200/60"
            style={{
              backgroundColor: accentAlpha(accent, 0.1),
              color: accent,
            }}
            aria-hidden
          >
            <LayoutGrid className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="sf-heading text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>

      <ul className="sf-category-bento-grid grid grid-cols-4 gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4">
        {rows.map((cat, index) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length
          const { span, size } = bentoLayout(index, total)

          return (
            <li key={cat.id} className={span}>
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className={[
                  'sf-category-bento-card group w-full text-start',
                  `sf-category-bento-card--${size}`,
                ].join(' ')}
              >
                <div className="sf-category-bento-content relative z-[2] p-3 pb-2 sm:p-3.5">
                  <p className="sf-category-bento-title line-clamp-2 text-[13px] font-extrabold leading-tight text-slate-900 sm:text-sm">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    {productCountLabel(count)}
                  </p>
                </div>

                <div className="sf-category-bento-media" aria-hidden>
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="sf-category-bento-img"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="sf-category-bento-fallback flex h-full w-full items-center justify-center text-3xl font-black sm:text-4xl"
                      style={{ color: accent }}
                    >
                      {label.charAt(0)}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
