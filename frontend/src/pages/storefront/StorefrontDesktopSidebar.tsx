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
      'sf-desktop-sidebar-link flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-start text-[13px] font-medium transition',
      active
        ? 'font-semibold'
        : 'text-slate-600 hover:bg-slate-50',
    ].join(' ')
  }

  function navStyle(active: boolean): CSSProperties | undefined {
    return active
      ? {
          backgroundColor: accentAlpha(accent, 0.1),
          color: accent,
        }
      : undefined
  }

  return (
    <aside className="sf-desktop-sidebar hidden w-[14rem] shrink-0 lg:block xl:w-[15rem]">
      <div className="sf-desktop-sidebar-inner sticky top-[5.75rem] max-h-[calc(100dvh-6.5rem)] overflow-y-auto rounded-xl border border-slate-200/70 bg-white p-2.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <p className="mb-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
            <p className="mb-1.5 mt-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold" style={{ color: accent }}>
                            {label.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}

        <p className="mb-1.5 mt-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
