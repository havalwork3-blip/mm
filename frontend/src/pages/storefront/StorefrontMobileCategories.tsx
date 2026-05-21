import { ChevronLeft } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { accentAlpha } from './storefrontTheme'

const GRADIENTS = [
  'linear-gradient(145deg, #7c3aed 0%, #a78bfa 100%)',
  'linear-gradient(145deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(145deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(145deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(145deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(145deg, #14b8a6 0%, #2dd4bf 100%)',
]

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
  const rows = categories.filter((c) => c.products.length > 0)
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

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={[
                'sf-mobile-cat-card group flex flex-col overflow-hidden rounded-2xl bg-white text-start shadow-sm ring-1 ring-slate-200/60 transition duration-300',
                'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
                useGrid ? 'min-w-0' : 'w-[7.25rem] shrink-0',
              ].join(' ')}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-50 to-white p-2">
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="h-full w-full rounded-xl object-cover transition duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center rounded-xl text-2xl font-black text-white"
                    style={{ background: GRADIENTS[index % GRADIENTS.length] }}
                  >
                    {label.charAt(0)}
                  </div>
                )}
                <span
                  className="absolute end-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white opacity-0 transition group-hover:opacity-100"
                  style={{ backgroundColor: accentAlpha(accent, 0.85) }}
                  aria-hidden
                >
                  <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" />
                </span>
              </div>
              <div className="px-2 py-2.5">
                <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-800">{label}</p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  {productCountLabel(count)}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
