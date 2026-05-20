import { ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { isStorefrontMode } from '../../lib/storefrontConfig'
import { useStorefrontShop } from './StorefrontShopContext'
import { cartItemCount, useCartStore } from '../../store/cartStore'
import { CartDrawer } from './CartDrawer'
import { CheckoutModal } from './CheckoutModal'
import { storefrontStrings } from './storefrontStrings'

export function StorefrontLayout() {
  const { lang, setLang, isRtl } = useLocale()
  const s = storefrontStrings(lang)
  const { shopName, loading: shopLoading, error: shopError } = useStorefrontShop()
  const lines = useCartStore((st) => st.lines)
  const count = cartItemCount(lines)

  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  useEffect(() => {
    if (isStorefrontMode()) {
      setLang('ku')
    }
  }, [setLang])

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#020617] text-slate-50">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 55% at 15% 0%, rgba(99, 102, 241, 0.22), transparent 55%),
            radial-gradient(ellipse 70% 50% at 90% 80%, rgba(251, 191, 36, 0.12), transparent 50%),
            linear-gradient(165deg, #020617 0%, #0f172a 45%, #1e1b4b 100%)
          `,
        }}
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f172a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tracking-tight text-[#fde68a] sm:text-xl">
              {shopName}
            </p>
            <p className="truncate text-xs text-slate-400 sm:text-sm">{s.shopTagline}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              className="hidden rounded-full border border-white/10 bg-white/5 p-0.5 text-xs sm:flex"
              role="group"
              aria-label="Language"
            >
              {(['ku', 'ar', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={[
                    'rounded-full px-2.5 py-1 font-medium transition-colors',
                    lang === code
                      ? 'bg-[#fbbf24] text-[#0f172a]'
                      : 'text-slate-400 hover:text-slate-200',
                  ].join(' ')}
                >
                  {code === 'ku' ? 'کوردی' : code === 'ar' ? 'عربي' : 'EN'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fde68a] transition hover:border-[#fbbf24]/50 hover:bg-[#fbbf24]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fbbf24]"
              aria-label={s.cart}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={2} aria-hidden />
              {count > 0 ? (
                <span
                  className={[
                    'absolute -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#fbbf24] px-1 text-[10px] font-bold text-[#0f172a]',
                    isRtl ? '-start-1' : '-end-1',
                  ].join(' ')}
                >
                  {count > 99 ? '99+' : count}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 sm:py-8">
        {shopError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {shopError}
          </div>
        ) : shopLoading ? (
          <p className="text-center text-slate-400">{s.loading}</p>
        ) : (
          <Outlet />
        )}
      </main>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false)
          setCheckoutOpen(true)
        }}
      />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </div>
  )
}
