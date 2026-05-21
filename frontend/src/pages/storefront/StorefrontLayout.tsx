import { Globe, Home, LayoutGrid, Menu, Search, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontPrice } from './storefrontPriceContext'
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
  const {
    view,
    backToCategories,
    showAllProducts,
    search,
    searchOpen,
    setSearch,
    openSearch,
    closeSearch,
    setSearchActive,
  } = useStorefrontCatalog()
  const location = useLocation()
  const isInfoPage = /\/(contact|about|faq|location)\/?$/.test(location.pathname)

  const accent = resolveAccent(appearance.accent_color)
  const logoSrc = resolveMediaUrl(appearance.logo_url ?? null)
  const lines = useCartStore((st) => st.lines)
  const count = cartItemCount(lines)

  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)

  const onHome = view === 'categories' && !isInfoPage
  const onShop = (view === 'products' || view === 'product') && !isInfoPage

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
  }, [location.pathname, view])

  return (
    <div className="sf-root relative flex min-h-screen w-full overflow-x-hidden text-slate-900" style={storefrontCssVars(accent)}>
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80 lg:hidden"
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
                <div
                  className="flex rounded-xl bg-white p-0.5 text-[10px] font-bold shadow-sm ring-1 ring-slate-200/80"
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
                  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50"
                  aria-label={s.searchPlaceholder}
                >
                  <Search className="h-[18px] w-[18px]" aria-hidden />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setLangOpen((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50"
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

        <main className={`relative z-10 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] ${SF_MAIN}`}>
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

        {!shopLoading && !shopError && view !== 'product' ? (
          <nav
            className="sf-nav-pill fixed inset-x-4 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md lg:hidden sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 sm:rtl:translate-x-1/2"
            aria-label="Navigation"
          >
            <div className="sf-glass-strong flex items-center justify-around rounded-2xl border border-white/80 px-1 py-1.5 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  backToCategories()
                }}
                className={[
                  'flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-bold transition',
                  onHome ? 'sf-nav-item-active text-white' : 'text-slate-500',
                ].join(' ')}
                style={onHome ? { backgroundColor: accent } : undefined}
              >
                <Home className="h-5 w-5" strokeWidth={onHome ? 2.5 : 2} aria-hidden />
                {s.home}
              </button>
              <button
                type="button"
                onClick={showAllProducts}
                className={[
                  'flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-bold transition',
                  onShop ? 'sf-nav-item-active text-white' : 'text-slate-500',
                ].join(' ')}
                style={onShop ? { backgroundColor: accent } : undefined}
              >
                <LayoutGrid className="h-5 w-5" strokeWidth={onShop ? 2.5 : 2} aria-hidden />
                {s.scrollToProducts}
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-500"
              >
                <Menu className="h-5 w-5" aria-hidden />
                {s.menu}
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex min-w-[3.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-bold text-slate-500"
              >
                <span className="relative">
                  <ShoppingBag className="h-5 w-5" strokeWidth={2} aria-hidden />
                  {count > 0 ? (
                    <span
                      className="absolute -end-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[8px] font-extrabold text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {count > 9 ? '9+' : count}
                    </span>
                  ) : null}
                </span>
                {s.cart}
              </button>
            </div>
          </nav>
        ) : null}
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
