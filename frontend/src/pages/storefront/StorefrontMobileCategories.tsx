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

type TileVariant = 'featured' | 'standard'

/** Mobile: 2 cols — top featured full-width rows, then 2-up tiles. Desktop: 4-col bento. */
function tileLayout(index: number, total: number): { span: string; variant: TileVariant } {
  if (total === 1) {
    return { span: 'col-span-2 lg:col-span-4', variant: 'featured' }
  }
  if (total === 2) {
    return { span: 'col-span-1 lg:col-span-2', variant: 'featured' }
  }
  if (total === 3) {
    if (index < 2) return { span: 'col-span-1 lg:col-span-2', variant: 'featured' }
    return { span: 'col-span-2 lg:col-span-4', variant: 'featured' }
  }
  if (index < 2) {
    return { span: 'col-span-2 lg:col-span-2', variant: 'featured' }
  }
  return { span: 'col-span-1 lg:col-span-1', variant: 'standard' }
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

      <ul className="sf-category-bento-grid grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5 lg:gap-4">
        {rows.map((cat, index) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length
          const { span, variant } = tileLayout(index, total)

          return (
            <li key={cat.id} className={`${span} flex`}>
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className={[
                  'sf-category-bento-card group flex w-full text-start',
                  variant === 'featured'
                    ? 'sf-category-bento-card--featured'
                    : 'sf-category-bento-card--standard',
                ].join(' ')}
              >
                <div className="sf-category-bento-copy flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-3 sm:p-3.5">
                  <p className="sf-category-bento-title line-clamp-2 font-extrabold leading-snug text-slate-900">
                    {label}
                  </p>
                  <p className="text-[10px] font-medium text-slate-400 sm:text-[11px]">
                    {productCountLabel(count)}
                  </p>
                </div>

                <div className="sf-category-bento-visual shrink-0" aria-hidden>
                  {img ? (
                    <img src={img} alt="" className="sf-category-bento-img" loading="lazy" />
                  ) : (
                    <span
                      className="sf-category-bento-fallback"
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
