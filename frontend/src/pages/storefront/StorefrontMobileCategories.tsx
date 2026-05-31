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
      <header className="sf-shop-categories-header mb-3 sm:mb-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: accentAlpha(accent, 0.1),
              color: accent,
            }}
            aria-hidden
          >
            <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="sf-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
      </header>

      {/* Mobile: horizontal scroll */}
      <ul className="sf-category-scroll sf-scrollbar-none -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:hidden">
        {rows.map((cat) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          return (
            <li key={cat.id} className="w-[5.5rem] shrink-0">
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className="sf-category-chip group flex w-full flex-col items-center gap-2 text-center"
              >
                <span className="flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-2 transition group-active:scale-95 group-hover:border-slate-300 group-hover:shadow-sm">
                  {img ? (
                    <img src={img} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-xl font-bold" style={{ color: accent }}>
                      {label.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-slate-700">
                  {label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Tablet+: grid */}
      <ul className="sf-category-grid hidden grid-cols-3 gap-3 sm:grid md:grid-cols-4 lg:grid-cols-4 lg:gap-4">
        {rows.map((cat) => {
          const img = resolveMediaUrl(cat.image_url)
          const label = categoryDisplayName(cat, lang)
          const count = cat.products.length
          return (
            <li key={cat.id}>
              <button
                type="button"
                onClick={() => onSelect(cat.id)}
                className="sf-category-card group flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-start transition hover:border-slate-300 hover:shadow-[0_4px_16px_rgba(15,23,42,0.06)] active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 p-1.5">
                  {img ? (
                    <img src={img} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-lg font-bold" style={{ color: accent }}>
                      {label.charAt(0)}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {productCountLabel(count)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
