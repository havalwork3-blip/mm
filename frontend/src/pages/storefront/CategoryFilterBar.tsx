import { SlidersHorizontal } from 'lucide-react'

import type { PublicStorefrontCategory } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { accentAlpha } from './storefrontTheme'

const GRADIENTS = [
  'linear-gradient(145deg, #ff5a00, #ff8c42)',
  'linear-gradient(145deg, #10b981, #34d399)',
  'linear-gradient(145deg, #3b82f6, #60a5fa)',
  'linear-gradient(145deg, #8b5cf6, #c084fc)',
  'linear-gradient(145deg, #ec4899, #f472b6)',
]

type Props = {
  categories: PublicStorefrontCategory[]
  selectedId: number | null
  accent: string
  labels: {
    filter: string
    allCategories: string
    productCount: string
  }
  onSelect: (id: number | null) => void
}

export function CategoryFilterBar({
  categories,
  selectedId,
  accent,
  labels,
  onSelect,
}: Props) {
  const { lang } = useLocale()

  return (
    <div className="sf-glass sticky top-[calc(3.75rem+env(safe-area-inset-top))] z-20 -mx-[max(1rem,env(safe-area-inset-left))] border-b border-white/50 px-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] py-3.5 shadow-sm sm:top-[calc(4.25rem+env(safe-area-inset-top))] lg:hidden">
      <div className="mb-2.5 flex items-center gap-2 px-1">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: accentAlpha(accent, 0.12) }}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" style={{ color: accent }} aria-hidden />
        </span>
        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {labels.filter}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-1 pb-0.5 sf-scrollbar-none">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            'shrink-0 rounded-full px-5 py-2.5 text-xs font-extrabold transition sm:text-sm',
            selectedId == null
              ? 'text-white shadow-lg'
              : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80 hover:shadow-md',
          ].join(' ')}
          style={
            selectedId == null
              ? {
                  background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                  boxShadow: `0 6px 16px ${accentAlpha(accent, 0.35)}`,
                }
              : undefined
          }
        >
          {labels.allCategories}
        </button>
        {categories.filter((cat) => cat.products.length > 0).map((cat, index) => {
          const img = resolveMediaUrl(cat.image_url)
          const active = selectedId === cat.id
          const label = categoryDisplayName(cat, lang)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={[
                'flex shrink-0 items-center gap-2 rounded-full py-2 ps-2 pe-4 transition sm:pe-5',
                active
                  ? 'text-white shadow-lg'
                  : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:shadow-md',
              ].join(' ')}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                      boxShadow: `0 6px 16px ${accentAlpha(accent, 0.35)}`,
                    }
                  : undefined
              }
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ring-2 ring-white/30"
                style={{ background: img ? undefined : GRADIENTS[index % GRADIENTS.length] }}
              >
                {img ? (
                  <img src={img} alt="" className="h-full w-full object-cover" />
                ) : (
                  label.charAt(0)
                )}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="max-w-[7rem] truncate text-xs font-bold sm:max-w-[9rem] sm:text-sm">
                  {label}
                </span>
                <span className={`text-[10px] font-medium ${active ? 'text-white/80' : 'text-slate-400'}`}>
                  {labels.productCount.replace('{n}', String(cat.products.length))}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
