import { ChevronLeft } from 'lucide-react'

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
      <header className="mb-4 sm:mb-5">
        <h2 className="sf-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{subtitle}</p>
        ) : null}
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
                className="sf-category-simple-card group flex w-full flex-col text-start"
                style={{ ['--sf-cat-accent' as string]: accent }}
              >
                <div className="sf-category-simple-media relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-50">
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-2xl font-black sm:text-3xl"
                      style={{ color: accent }}
                    >
                      {label.charAt(0)}
                    </div>
                  )}
                  <span
                    className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-200/80 transition group-hover:opacity-100"
                    aria-hidden
                  >
                    <ChevronLeft className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" />
                  </span>
                </div>

                <div className="pt-3 text-center">
                  <p className="line-clamp-2 text-[13px] font-bold leading-snug text-slate-800 sm:text-sm">
                    {label}
                  </p>
                  <p
                    className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]"
                    style={{
                      backgroundColor: accentAlpha(accent, 0.08),
                      color: accent,
                    }}
                  >
                    {productCountLabel(count)}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
