import { ChevronLeft, LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { sortStorefrontCategories } from './storefrontCategoryCardTheme'
import { accentAlpha, SF_CATEGORY_GRID } from './storefrontTheme'

type Props = {
  categories: PublicStorefrontCategory[]
  title: string
  subtitle?: string
  accent: string
  productCountLabel: (n: number) => string
  onSelect: (id: number) => void
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

  return (
    <section className="sf-shop-categories">
      <header className="sf-shop-categories-header mb-4 sm:mb-5">
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-slate-200/60"
            style={{
              backgroundColor: accentAlpha(accent, 0.1),
              color: accent,
            }}
            aria-hidden
          >
            <LayoutGrid className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="sf-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>

      <ul className={SF_CATEGORY_GRID}>
        {rows.map((cat) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length

          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className="sf-cat-card sf-card-shine group w-full text-start"
                style={{ ['--sf-cat-accent' as string]: accent }}
              >
                <div className="sf-cat-card-visual">
                  <div className="sf-cat-card-frame">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-2xl font-black sm:text-[1.65rem]"
                        style={{ color: accent }}
                      >
                        {label.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sf-cat-card-body">
                  <div className="sf-cat-card-title-row">
                    <p className="sf-cat-card-name">{label}</p>
                    <span className="sf-cat-card-arrow" aria-hidden>
                      <ChevronLeft className="h-4 w-4 rotate-180 rtl:rotate-0" />
                    </span>
                  </div>
                  <span className="sf-cat-card-count">{productCountLabel(count)}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
