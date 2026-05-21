import { Globe, Menu, Moon, Search, ShoppingBag, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontPrice } from './storefrontPriceContext'
import { useStorefrontTheme } from './storefrontThemeContext'
import { cartItemCount, useCartStore } from '../../store/cartStore'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'
import { StorefrontSearchOverlay } from './StorefrontSearchOverlay'
import { StorefrontSidebar } from './StorefrontSidebar'
import { storefrontStrings } from './storefrontStrings'
import { accentAlpha, resolveAccent, SF_MAIN, SF_SHELL, storefrontCssVars } from './storefrontTheme'
import { resolveMediaUrl } from '../../lib/api'

export function StorefrontLayout() {
  const { lang, setLang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopName, appearance, loading: shopLoading, error: shopError } = useStorefrontShop()
  const { currency, setCurrency } = useStorefrontPrice()
  const { theme, toggleTheme } = useStorefrontTheme()
  const {
    backToCategories,
    search,
    searchOpen,
    setSearch,
    openSearch,
    closeSearch,
    setSearchActive,
  } = useStorefrontCatalog()
  const location = useLocation()

  const accent = resolveAccent(appearance.accent_color)
  const logoSrc = resolveMediaUrl(appearance.logo_url ?? null)
  const lines = useCartStore((st) => st.lines)
  const count = cartItemCount(lines)

  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)

  const isDark = theme === 'dark'

  useEffect(() => {
    document.documentElement.classList.add('sf-mode')
    return () => document.documentElement.classList.remove('sf-mode')
  }, [])

  useEffect(() => {
    const onPulse = () => setCartPulse(true)
    window.addEventListener('sf-cart-pulse', onPulse)
    return () => window.removeEventListener('sf-cart-pulse', onPulse)
  }, [])

  useEffect(() => {
    if (!cartPulse) return
    const t = window.setTimeout(() => setCartPulse(false), 600)
    return () => window.clearTimeout(t)
  }, [cartPulse])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div
      className={['sf-root relative flex min-h-screen w-full overflow-x-hidden', isDark ? 'sf-dark' : ''].join(' ')}
      style={storefrontCssVars(accent)}
    >
      {!shopLoading && !shopError ? (
        <StorefrontSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          accent={accent}
          lang={lang}
          cartCount={count}
          onOpenCart={() => setCartOpen(true)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {!shopLoading && !shopError ? (
          <header className="sf-glass-strong sticky top-0 z-30 w-full border-b border-white/60 shadow-sm pt-[env(safe-area-inset-top)]">
            <div className={`${SF_SHELL} flex items-center gap-2 py-3 sm:gap-2.5`}>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="sf-surface-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition hover:opacity-90"
                aria-label={s.menu}
              >
                <Menu className="h-[18px] w-[18px]" aria-hidden />
              </button>

              <button
                type="button"
                onClick={backToCategories}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-start transition active:scale-[0.98] sm:gap-3"
              >
                <span
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-base font-bold text-white shadow-md sm:h-11 sm:w-11"
                  style={
                    logoSrc
                      ? { boxShadow: `0 6px 20px ${accentAlpha(accent, 0.25)}` }
                      : {
                          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                          boxShadow: `0 6px 20px ${accentAlpha(accent, 0.35)}`,
                        }
                  }
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    shopName.charAt(0) || 'M'
                  )}
                </span>
                <div className="min-w-0 hidden sm:block">
                  <p className="truncate text-[14px] font-extrabold tracking-tight text-slate-900 sm:text-[15px]">
                    {shopName}
                  </p>
                  <p className="truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">
                    {appearance.catalog_subtitle || s.shopTagline}
                  </p>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="sf-surface-btn flex h-10 w-10 items-center justify-center rounded-2xl transition hover:opacity-90"
                  aria-label={isDark ? s.lightMode : s.darkMode}
                >
                  {isDark ? (
                    <Sun className="h-[18px] w-[18px]" aria-hidden />
                  ) : (
                    <Moon className="h-[18px] w-[18px]" aria-hidden />
                  )}
                </button>

                <div
                  className="sf-surface-pill flex rounded-xl p-0.5 text-[10px] font-bold"
                  role="group"
                  aria-label={s.currencyLabel}
                >
                  {(['usd', 'iqd'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCurrency(code)}
                      className={[
                        'rounded-lg px-2 py-1.5 transition',
                        currency === code ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
                      ].join(' ')}
                      style={currency === code ? { backgroundColor: accent } : undefined}
                    >
                      {code === 'usd' ? s.usd : s.iqd}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openSearch}
                  className="sf-surface-btn flex h-10 w-10 items-center justify-center rounded-2xl transition hover:opacity-90"
                  aria-label={s.searchPlaceholder}
                >
                  <Search className="h-[18px] w-[18px]" aria-hidden />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLangOpen((v) => !v)}
                    className="sf-surface-btn flex h-10 w-10 items-center justify-center rounded-2xl transition hover:opacity-90"
                    aria-expanded={langOpen}
                    aria-label={s.language}
                  >
                    <Globe className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                  {langOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-40"
                        aria-label={s.close}
                        onClick={() => setLangOpen(false)}
                      />
                      <div className="absolute end-0 top-full z-50 mt-2 min-w-[8rem] overflow-hidden rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
                        {(['ku', 'ar', 'en'] as const).map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => {
                              setLang(code)
                              setLangOpen(false)
                            }}
                            className={[
                              'mx-1.5 block w-[calc(100%-12px)] rounded-xl px-3 py-2 text-start text-xs font-semibold',
                              lang === code ? 'text-white' : 'text-slate-600 hover:bg-slate-50',
                            ].join(' ')}
                            style={lang === code ? { backgroundColor: accent } : undefined}
                          >
                            {code === 'ku' ? 'کوردی' : code === 'ar' ? 'عربي' : 'English'}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                <button
                  id="sf-cart-anchor"
                  type="button"
                  onClick={() => setCartOpen(true)}
                  className={[
                    'relative flex h-10 items-center gap-1.5 rounded-2xl px-3 text-sm font-bold text-white shadow-md transition active:scale-95',
                    cartPulse ? 'sf-cart-pulse' : '',
                  ].join(' ')}
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                    boxShadow: `0 6px 20px ${accentAlpha(accent, 0.4)}`,
                  }}
                >
                  <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                  {count > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-extrabold">
                      {count > 99 ? '99+' : count}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          </header>
        ) : null}

        <main className={`relative z-10 flex-1 pb-6 ${SF_MAIN}`}>
          {shopError ? (
            <div className="mx-4 mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {shopError}
            </div>
          ) : shopLoading ? (
            <div className="flex flex-col items-center gap-3 py-24">
              <div
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200"
                style={{ borderTopColor: accent }}
              />
              <p className="text-sm font-medium text-slate-500">{s.loading}</p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      <CartDrawer
        open={cartOpen}
        accent={accent}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
      />
      <CheckoutModal open={checkoutOpen} accent={accent} onClose={() => setCheckoutOpen(false)} />

      <StorefrontSearchOverlay
        open={searchOpen}
        value={search}
        onChange={(v) => {
          setSearch(v)
          setSearchActive(v.trim().length > 0)
        }}
        onClose={closeSearch}
        placeholder={s.searchPlaceholder}
        accent={accent}
        closeLabel={s.close}
      />
    </div>
  )
}
