import type { CSSProperties } from 'react'
import {
  BadgePercent,
  Flame,
  Heart,
  Home,
  LayoutGrid,
  PackageCheck,
  Sparkles,
} from 'lucide-react'

import type { PublicStorefrontCategory, StorefrontProductCollection } from '../../api/storefrontApi'
import { useLocale } from '../../context/LocaleContext'
import { categoryDisplayName } from '../../lib/categoryNames'
import { resolveMediaUrl } from '../../lib/api'
import { sortStorefrontCategories } from './storefrontCategoryCardTheme'
import { storefrontCollectionLabel } from './storefrontDisplay'
import type { PublicStorefrontAppearance } from '../../api/storefrontApi'
import type { StorefrontStrings } from './storefrontStrings'
import { accentAlpha } from './storefrontTheme'

const COLLECTION_LINKS: {
  id: StorefrontProductCollection
  icon: typeof Flame
}[] = [
  { id: 'bestsellers', icon: Flame },
  { id: 'new_arrivals', icon: Sparkles },
  { id: 'on_sale', icon: BadgePercent },
  { id: 'available_now', icon: PackageCheck },
]

type Props = {
  accent: string
  appearance: PublicStorefrontAppearance
  strings: StorefrontStrings
  categories: PublicStorefrontCategory[]
  view: 'categories' | 'products' | 'product'
  selectedCategoryId: number | null
  productCollection: StorefrontProductCollection | null
  onHome: () => void
  onAllProducts: () => void
  onSelectCategory: (id: number) => void
  onSelectCollection: (id: StorefrontProductCollection) => void
  onFavorites: () => void
}

export function StorefrontDesktopSidebar({
  accent,
  appearance,
  strings: s,
  categories,
  view,
  selectedCategoryId,
  productCollection,
  onHome,
  onAllProducts,
  onSelectCategory,
  onSelectCollection,
  onFavorites,
}: Props) {
  const { lang } = useLocale()
  const rows = sortStorefrontCategories(categories.filter((c) => c.products.length > 0))
  const homeActive = view === 'categories'
  const allActive =
    view === 'products' && selectedCategoryId == null && productCollection == null
  const favActive = productCollection === 'favorites'

  function navClass(active: boolean): string {
    return [
      'sf-desktop-sidebar-link flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm font-bold transition',
      active
        ? 'text-white shadow-sm'
        : 'text-slate-700 hover:bg-slate-100/90',
    ].join(' ')
  }

  function navStyle(active: boolean): CSSProperties | undefined {
    return active
      ? {
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 4px 14px ${accentAlpha(accent, 0.25)}`,
        }
      : undefined
  }

  return (
    <aside className="sf-desktop-sidebar hidden w-[15.5rem] shrink-0 lg:block xl:w-[17rem]">
      <div className="sf-desktop-sidebar-inner sticky top-[5.75rem] max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
        <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {s.categories}
        </p>

        <nav className="space-y-1">
          <button
            type="button"
            onClick={onHome}
            className={navClass(homeActive)}
            style={navStyle(homeActive)}
          >
            <Home className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {s.home}
          </button>
          <button
            type="button"
            onClick={onAllProducts}
            className={navClass(allActive)}
            style={navStyle(allActive)}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {s.allProducts}
          </button>
          <button
            type="button"
            onClick={onFavorites}
            className={navClass(favActive)}
            style={navStyle(favActive)}
          >
            <Heart className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            {s.myFavorites}
          </button>
        </nav>

        {rows.length > 0 ? (
          <>
            <p className="mb-2 mt-4 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {s.shopCategories}
            </p>
            <ul className="space-y-0.5">
              {rows.map((cat) => {
                const active = view === 'products' && selectedCategoryId === cat.id
                const img = resolveMediaUrl(cat.image_url)
                const label = categoryDisplayName(cat, lang)
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => onSelectCategory(cat.id)}
                      className={navClass(active)}
                      style={navStyle(active)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 ring-1 ring-white/40">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-black" style={{ color: accent }}>
                            {label.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{label}</span>
                        <span
                          className={[
                            'block text-[10px] font-semibold',
                            active ? 'text-white/80' : 'text-slate-400',
                          ].join(' ')}
                        >
                          {s.productCount.replace('{n}', String(cat.products.length))}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}

        <p className="mb-2 mt-4 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {s.shopHighlights}
        </p>
        <ul className="space-y-0.5">
          {COLLECTION_LINKS.map(({ id, icon: Icon }) => {
            const active = productCollection === id
            const label = storefrontCollectionLabel(appearance, s, id)
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelectCollection(id)}
                  className={navClass(active)}
                  style={navStyle(active)}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
