import { Globe, Home, LayoutGrid, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { isStorefrontMode } from '../../lib/storefrontConfig'
import { useStorefrontShop } from './StorefrontShopContext'
import { cartItemCount, useCartStore } from '../../store/cartStore'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'
import { storefrontStrings } from './storefrontStrings'
import { resolveAccent, SF_MAIN, SF_SHELL } from './storefrontTheme'

export function StorefrontLayout() {
  const { lang, setLang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopName, appearance, loading: shopLoading, error: shopError } = useStorefrontShop()
  const accent = resolveAccent(appearance.accent_color)
  const lines = useCartStore((st) => st.lines)
  const count = cartItemCount(lines)

  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)

  useEffect(() => {
    if (isStorefrontMode()) {
      setLang('ku')
    }
  }, [setLang])

  useEffect(() => {
    document.documentElement.classList.add('sf-mode')
    return () => document.documentElement.classList.remove('sf-mode')
  }, [])

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollToProducts() {
    document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      className="sf-root relative w-full overflow-x-hidden bg-[#f0f2f5] text-slate-900"
      style={{ '--sf-accent': accent } as React.CSSProperties}
    >
      {!shopLoading && !shopError ? (
        <header className="sticky top-0 z-30 w-full border-b border-slate-200/70 bg-white/90 backdrop-blur-lg pt-[env(safe-area-inset-top)]">
          <div className={`${SF_SHELL} flex items-center gap-2 py-2.5 sm:gap-3 sm:py-3`}>
            <button
              type="button"
              onClick={scrollTop}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-start sm:gap-3"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm sm:h-12 sm:w-12 sm:text-base"
                style={{ backgroundColor: accent }}
              >
                {shopName.charAt(0) || 'M'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 sm:text-base md:text-lg">
                  {shopName}
                </p>
                <p className="truncate text-[11px] text-slate-500 sm:text-xs md:text-sm">
                  {appearance.catalog_subtitle || s.shopTagline}
                </p>
              </div>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-50 sm:h-10 sm:w-10"
                aria-label="Language"
                aria-expanded={langOpen}
              >
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              </button>
              {langOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40"
                    aria-label={s.close}
                    onClick={() => setLangOpen(false)}
                  />
                  <div className="absolute end-0 top-full z-50 mt-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    {(['ku', 'ar', 'en'] as const).map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setLang(code)
                          setLangOpen(false)
                        }}
                        className={[
                          'block w-full px-3 py-2 text-start text-xs font-medium transition sm:text-sm',
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
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition active:scale-95 sm:h-10 sm:w-10 md:hidden"
              style={{ backgroundColor: accent }}
              aria-label={s.cart}
            >
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
              {count > 0 ? (
                <span className="absolute -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-0.5 text-[9px] font-bold text-white end-0 sm:text-[10px]">
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative hidden h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 md:inline-flex"
              style={{ backgroundColor: accent }}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {s.cart}
              {count > 0 ? (
                <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">{count}</span>
              ) : null}
            </button>
          </div>
        </header>
      ) : null}

      <main
        className={`relative z-10 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-[calc(3.5rem+env(safe-area-inset-bottom))] ${SF_MAIN}`}
      >
        {shopError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {shopError}
          </div>
        ) : shopLoading ? (
          <p className="py-20 text-center text-sm text-slate-500">{s.loading}</p>
        ) : (
          <Outlet />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 w-full border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:pb-[env(safe-area-inset-bottom)]"
        aria-label="Navigation"
      >
        <div
          className={`${SF_SHELL} flex items-center justify-around py-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:py-2 md:max-w-none`}
        >
          <button
            type="button"
            onClick={scrollTop}
            className="flex min-w-[4.5rem] flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-semibold sm:min-w-[5.5rem] sm:text-xs"
            style={{ color: accent }}
          >
            <Home className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} aria-hidden />
            {s.home}
          </button>
          <button
            type="button"
            onClick={scrollToProducts}
            className="flex min-w-[4.5rem] flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-slate-500 sm:min-w-[5.5rem] sm:text-xs"
          >
            <LayoutGrid className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
            {s.scrollToProducts}
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex min-w-[4.5rem] flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-slate-500 md:hidden sm:min-w-[5.5rem] sm:text-xs"
          >
            <span className="relative">
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              {count > 0 ? (
                <span
                  className="absolute -end-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white sm:h-4 sm:min-w-4 sm:text-[9px]"
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
    </div>
  )
}
