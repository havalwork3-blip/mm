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
    <div
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-[max(1rem,env(safe-area-inset-left))] border-b border-slate-200/80 bg-white/95 px-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] py-3 shadow-sm backdrop-blur-md sm:top-[calc(4rem+env(safe-area-inset-top))]"
    >
      <div className="mb-2 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
          {labels.filter}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 sf-scrollbar-none">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={[
            'shrink-0 rounded-full px-4 py-2 text-xs font-bold transition sm:text-sm',
            selectedId == null
              ? 'text-white shadow-md'
              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
          ].join(' ')}
          style={
            selectedId == null
              ? { backgroundColor: accent, boxShadow: `0 4px 12px ${accentAlpha(accent, 0.35)}` }
              : undefined
          }
        >
          {labels.allCategories}
        </button>
        {categories.map((cat, index) => {
          const img = resolveMediaUrl(
            cat.image_url ?? cat.products.find((p) => p.image_url)?.image_url ?? null,
          )
          const active = selectedId === cat.id
          const label = categoryDisplayName(cat, lang)
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={[
                'flex shrink-0 items-center gap-2 rounded-full py-1.5 ps-1 pe-3 transition sm:pe-4',
                active ? 'text-white shadow-md' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:shadow-sm',
              ].join(' ')}
              style={
                active
                  ? { backgroundColor: accent, boxShadow: `0 4px 12px ${accentAlpha(accent, 0.35)}` }
                  : undefined
              }
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white sm:h-9 sm:w-9"
                style={{ background: img ? undefined : GRADIENTS[index % GRADIENTS.length] }}
              >
                {img ? (
                  <img src={img} alt="" className="h-full w-full object-cover" />
                ) : (
                  label.charAt(0)
                )}
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="max-w-[6rem] truncate text-xs font-bold sm:max-w-[8rem] sm:text-sm">
                  {label}
                </span>
                <span className={`text-[10px] ${active ? 'text-white/85' : 'text-slate-400'}`}>
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
