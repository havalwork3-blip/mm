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
  const navActive =
    view === 'products' && selectedCategoryId == null && !productCollection

  return (
    <header className="sf-desktop-header hidden lg:block">
      <div className="sf-desktop-header-top border-b border-slate-200/90 bg-white/95 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className={`${SF_DESKTOP_SHELL} flex items-center gap-5 py-3.5 xl:gap-6 xl:py-4`}>
          <button
            type="button"
            onClick={backToCategories}
            className="group flex shrink-0 items-center gap-3 text-start transition hover:opacity-90"
          >
            <span
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200/80 transition group-hover:ring-2"
              style={{ boxShadow: `0 8px 24px ${accentAlpha(accent, 0.18)}` }}
            >
              {logoSrc ? (
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-lg font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                >
                  {shopName.charAt(0) || 'M'}
                </span>
              )}
            </span>
            {(headerTitle || headerSubtitle) ? (
              <div className="hidden min-w-0 max-w-[11rem] xl:block">
                {headerTitle ? (
                  <p className="truncate text-[15px] font-extrabold tracking-tight text-slate-900">
                    {headerTitle}
                  </p>
                ) : null}
                {headerSubtitle ? (
                  <p className="truncate text-[11px] font-medium text-slate-500">{headerSubtitle}</p>
                ) : null}
              </div>
            ) : null}
          </button>

          <form
            className="mx-auto flex min-w-0 max-w-3xl flex-1"
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
                className="sf-desktop-search w-full rounded-2xl border border-slate-200/90 bg-slate-50/90 py-3.5 ps-12 pe-4 text-sm font-medium text-slate-800 shadow-inner outline-none transition focus:border-transparent focus:bg-white focus:ring-2 focus:ring-[color:var(--sf-accent-ring)]"
                style={{ ['--sf-accent-ring' as string]: accentAlpha(accent, 0.35) }}
                dir="auto"
              />
            </div>
          </form>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpenMenu}
              className="sf-desktop-icon-btn flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              aria-label={s.menu}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onShowFavorites}
              className={[
                'sf-desktop-icon-btn relative flex h-11 w-11 items-center justify-center rounded-xl border transition',
                favoritesActive
                  ? 'border-rose-200 bg-rose-50 text-rose-600 shadow-sm'
                  : 'border-slate-200/90 bg-white text-slate-600 shadow-sm hover:bg-slate-50',
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
                'sf-desktop-cart-btn relative flex h-11 items-center gap-2.5 rounded-xl px-5 text-sm font-bold text-white shadow-md transition hover:brightness-105',
                cartPulse ? 'sf-cart-pulse' : '',
              ].join(' ')}
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                boxShadow: `0 8px 22px ${accentAlpha(accent, 0.35)}`,
              }}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              <span>{s.cart}</span>
              {cartCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-[10px] font-extrabold">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      <nav className="sf-desktop-nav border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className={`${SF_DESKTOP_SHELL} flex items-center gap-2 py-2.5 xl:py-3`}>
          <button
            type="button"
            onClick={showAllProducts}
            className={[
              'sf-desktop-nav-pill flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition',
              navActive
                ? 'text-white shadow-md'
                : 'border border-transparent bg-slate-100/80 text-slate-700 hover:bg-slate-100',
            ].join(' ')}
            style={
              navActive
                ? {
                    background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                    boxShadow: `0 4px 14px ${accentAlpha(accent, 0.28)}`,
                  }
                : undefined
            }
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            {s.allCategories}
          </button>

          <div className="sf-scrollbar-none flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5">
            {cats.map((cat) => {
              const active = view === 'products' && selectedCategoryId === cat.id
              const label = categoryDisplayName(cat, lang)
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => selectCategory(cat.id)}
                  className={[
                    'sf-desktop-nav-pill shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                    active
                      ? 'text-white shadow-md'
                      : 'text-slate-600 hover:bg-slate-100',
                  ].join(' ')}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                          boxShadow: `0 4px 12px ${accentAlpha(accent, 0.25)}`,
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
