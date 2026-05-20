import { Home, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { isStorefrontMode } from '../../lib/storefrontConfig'
import { useStorefrontShop } from './StorefrontShopContext'
import { cartItemCount, useCartStore } from '../../store/cartStore'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'
import { storefrontStrings } from './storefrontStrings'
import { resolveAccent } from './storefrontTheme'

export function StorefrontLayout() {
  const { lang, setLang } = useLocale()
  const s = storefrontStrings(lang)
  const { appearance, loading: shopLoading, error: shopError } = useStorefrontShop()
  const accent = resolveAccent(appearance.accent_color)
  const lines = useCartStore((st) => st.lines)
  const count = cartItemCount(lines)

  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => {
    if (isStorefrontMode()) {
      setLang('ku')
    }
  }, [setLang])

  function scrollHome() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden bg-[#f5f5f7] text-slate-900"
      style={{ '--sf-accent': accent } as React.CSSProperties}
    >
      <main className="relative z-10 mx-auto max-w-lg pb-24">
        {shopError ? (
          <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {shopError}
          </div>
        ) : shopLoading ? (
          <p className="py-16 text-center text-sm text-slate-500">{s.loading}</p>
        ) : (
          <Outlet />
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-slate-200/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md"
        aria-label="Navigation"
      >
        <div className="flex items-stretch justify-around gap-1">
          <button
            type="button"
            onClick={scrollHome}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition"
            style={{ color: accent }}
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, white)` }}
            >
              <Home className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            {s.home}
          </button>

          <div
            className="hidden rounded-full border border-slate-200 bg-slate-50 p-0.5 text-[10px] sm:flex"
            role="group"
            aria-label="Language"
          >
            {(['ku', 'ar', 'en'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={[
                  'rounded-full px-2 py-1 font-medium transition-colors',
                  lang === code ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-800',
                ].join(' ')}
                style={lang === code ? { backgroundColor: accent } : undefined}
              >
                {code === 'ku' ? 'کوردی' : code === 'ar' ? 'عربي' : 'EN'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-slate-500 transition hover:text-slate-800"
            aria-label={s.cart}
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <ShoppingBag className="h-5 w-5" strokeWidth={2} aria-hidden />
              {count > 0 ? (
                <span
                  className="absolute -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white end-0"
                  style={{ backgroundColor: accent }}
                >
                  {count > 99 ? '99+' : count}
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
