import { ChevronLeft, LayoutGrid } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { accentAlpha } from './storefrontTheme'

const GRADIENTS = [
  'linear-gradient(145deg, #ff5a00 0%, #ff8c42 100%)',
  'linear-gradient(145deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(145deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(145deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(145deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(145deg, #14b8a6 0%, #2dd4bf 100%)',
]

type Props = {
  categories: PublicStorefrontCategory[]
  accent: string
  allLabel: string
  onSelectAll: () => void
  onSelectCategory: (id: number) => void
}

export function StorefrontCategoryIconsRow({
  categories,
  accent,
  allLabel,
  onSelectAll,
  onSelectCategory,
}: Props) {
  const { lang } = useLocale()
  const rows = categories.filter((c) => c.products.length > 0)

  if (rows.length === 0) return null

  return (
    <div className="sf-cat-icons-row hidden lg:block">
      <div className="sf-cat-icons-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-4 gap-5 xl:grid-cols-6 2xl:grid-cols-8">
          <button
            type="button"
            onClick={onSelectAll}
            className="sf-cat-icon-btn group flex flex-col items-center gap-2.5"
          >
            <span
              className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-2xl text-white shadow-md ring-2 ring-white transition group-hover:scale-[1.04] group-hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                boxShadow: `0 8px 24px ${accentAlpha(accent, 0.35)}`,
              }}
            >
              <LayoutGrid className="h-6 w-6" aria-hidden />
            </span>
            <span className="line-clamp-2 text-center text-xs font-bold leading-tight text-slate-700">
              {allLabel}
            </span>
          </button>

          {rows.map((cat, index) => {
            const img = resolveMediaUrl(cat.image_url)
            const label = categoryDisplayName(cat, lang)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className="sf-cat-icon-btn group flex flex-col items-center gap-2.5"
              >
                <span className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-2 ring-slate-100/90 transition group-hover:scale-[1.04] group-hover:shadow-lg group-hover:ring-violet-200/80">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-xl font-black text-white"
                      style={{ background: GRADIENTS[index % GRADIENTS.length] }}
                    >
                      {label.charAt(0)}
                    </span>
                  )}
                  <span
                    className="absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-600 shadow-md opacity-0 transition group-hover:opacity-100"
                    aria-hidden
                  >
                    <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" />
                  </span>
                </span>
                <span className="line-clamp-2 text-center text-xs font-bold leading-tight text-slate-700">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
