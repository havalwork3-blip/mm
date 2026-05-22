import { Heart, LayoutGrid, Menu, Search, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { resolveMediaUrl } from '../../lib/api'
import { categoryDisplayName } from '../../lib/categoryNames'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { useStorefrontShop } from './StorefrontShopContext'
import { storefrontStrings } from './storefrontStrings'
import { storefrontHeaderSubtitle, storefrontHeaderTitle } from './storefrontDisplay'
import { accentAlpha, SF_DESKTOP_SHELL } from './storefrontTheme'

type Props = {
  accent: string
  cartCount: number
  favCount: number
  favoritesActive: boolean
  cartPulse: boolean
  onOpenCart: () => void
  onShowFavorites: () => void
  onOpenMenu: () => void
}

function darkenHex(hex: string, amount = 0.55): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h.slice(0, 6)
  const n = Number.parseInt(full, 16)
  if (Number.isNaN(n)) return '#1e3a5f'
  const r = Math.round(((n >> 16) & 255) * (1 - amount))
  const g = Math.round(((n >> 8) & 255) * (1 - amount))
  const b = Math.round((n & 255) * (1 - amount))
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

export function StorefrontDesktopHeader({
  accent,
  cartCount,
  favCount,
  favoritesActive,
  cartPulse,
  onOpenCart,
  onShowFavorites,
  onOpenMenu,
}: Props) {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopName, appearance } = useStorefrontShop()
  const {
    catalogCategories,
    search,
    setSearch,
    setSearchActive,
    selectCategory,
    showAllProducts,
    backToCategories,
    view,
    selectedCategoryId,
    productCollection,
  } = useStorefrontCatalog()

  const [query, setQuery] = useState(search)
  const logoSrc = resolveMediaUrl(appearance.logo_url ?? null)
  const navDark = darkenHex(accent, 0.72)
  const headerTitle = storefrontHeaderTitle(appearance, shopName)
  const headerSubtitle = storefrontHeaderSubtitle(appearance)

  useEffect(() => {
    setQuery(search)
  }, [search])

  function submitSearch() {
    const q = query.trim()
    setSearch(q)
    if (q) setSearchActive(true)
  }

  const cats = catalogCategories.filter((c) => c.products.length > 0)

  return (
    <header className="sf-desktop-header hidden lg:block">
      <div
        className="border-b border-white/10 text-white"
        style={{
          background: `linear-gradient(90deg, ${navDark} 0%, ${accent} 55%, ${navDark} 100%)`,
        }}
      >
        <div className={`${SF_DESKTOP_SHELL} flex items-center gap-4 py-3`}>
          <button
            type="button"
            onClick={backToCategories}
            className="flex shrink-0 items-center gap-3 text-start transition hover:opacity-95"
          >
            <span
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/15 text-lg font-bold backdrop-blur-sm"
            >
              {logoSrc ? (
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                shopName.charAt(0) || 'M'
              )}
            </span>
            {(headerTitle || headerSubtitle) ? (
              <div className="min-w-0 max-w-[12rem]">
                {headerTitle ? (
                  <p className="truncate text-[15px] font-extrabold">{headerTitle}</p>
                ) : null}
                {headerSubtitle ? (
                  <p className="truncate text-[11px] text-white/75">{headerSubtitle}</p>
                ) : null}
              </div>
            ) : null}
          </button>

          <form
            className="mx-auto flex min-w-0 max-w-2xl flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              submitSearch()
            }}
          >
            <div className="relative flex w-full items-center">
              <Search
                className="pointer-events-none absolute start-4 h-5 w-5 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!e.target.value.trim()) setSearch('')
                }}
                placeholder={s.searchPlaceholder}
                className="w-full rounded-xl border-0 bg-white py-3 ps-12 pe-4 text-sm font-medium text-slate-800 shadow-lg outline-none ring-2 ring-white/20 focus:ring-white/40"
                dir="auto"
              />
            </div>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 transition hover:bg-white/25"
              aria-label={s.menu}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onShowFavorites}
              className={[
                'relative flex h-11 w-11 items-center justify-center rounded-xl transition',
                favoritesActive ? 'bg-white text-rose-500 shadow-md' : 'bg-white/15 hover:bg-white/25',
              ].join(' ')}
              aria-label={s.myFavorites}
              aria-pressed={favoritesActive}
            >
              <Heart className={['h-5 w-5', favoritesActive ? 'fill-current' : ''].join(' ')} />
              {favCount > 0 ? (
                <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {favCount > 99 ? '99+' : favCount}
                </span>
              ) : null}
            </button>

            <button
              id="sf-cart-anchor"
              type="button"
              onClick={onOpenCart}
              className={[
                'relative flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold shadow-md transition hover:bg-white/95',
                cartPulse ? 'sf-cart-pulse' : '',
              ].join(' ')}
              style={{ color: accent }}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              <span>{s.cart}</span>
              {cartCount > 0 ? (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <nav className="border-b border-slate-200/80 bg-white shadow-sm">
        <div className={`${SF_DESKTOP_SHELL} flex items-center gap-1 py-2.5`}>
          <button
            type="button"
            onClick={showAllProducts}
            className={[
              'sf-desktop-nav-pill flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition',
              view === 'products' && selectedCategoryId == null && !productCollection
                ? 'text-white shadow-md'
                : 'text-slate-700 hover:bg-slate-100',
            ].join(' ')}
            style={
              view === 'products' && selectedCategoryId == null && !productCollection
                ? { background: `linear-gradient(135deg, ${accent}, ${accent}dd)` }
                : undefined
            }
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {s.allCategories}
          </button>

          <div className="sf-scrollbar-none flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {cats.map((cat) => {
              const active = view === 'products' && selectedCategoryId === cat.id
              const label = categoryDisplayName(cat, lang)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  className={[
                    'sf-desktop-nav-pill shrink-0 rounded-lg px-4 py-2 text-sm font-bold transition',
                    active ? 'text-white shadow-md' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                          boxShadow: `0 4px 12px ${accentAlpha(accent, 0.3)}`,
                        }
                      : undefined
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </header>
  )
}
