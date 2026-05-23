import { ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { accentAlpha } from './storefrontTheme'

type Props = {
  accent: string
  onOpenCart: () => void
  cartOpen: boolean
}

const AUTO_HIDE_MS = 8000

export function StorefrontViewCartNudge({ accent, onOpenCart, cartOpen }: Props) {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { view } = useStorefrontCatalog()
  const visible = useCartStore((st) => st.showViewCartNudge)
  const dismiss = useCartStore((st) => st.dismissViewCartNudge)
  const [nudgePulse, setNudgePulse] = useState(false)
  const overProduct = view === 'product'

  useEffect(() => {
    if (!visible || cartOpen) return
    const t = window.setTimeout(() => dismiss(), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [visible, cartOpen, dismiss])

  useEffect(() => {
    if (cartOpen && visible) dismiss()
  }, [cartOpen, visible, dismiss])

  useEffect(() => {
    const onPulse = () => setNudgePulse(true)
    window.addEventListener('sf-nudge-pulse', onPulse)
    return () => window.removeEventListener('sf-nudge-pulse', onPulse)
  }, [])

  useEffect(() => {
    if (!nudgePulse) return
    const t = window.setTimeout(() => setNudgePulse(false), 600)
    return () => window.clearTimeout(t)
  }, [nudgePulse])

  if (!visible || cartOpen) return null

  function handleOpen() {
    dismiss()
    onOpenCart()
  }

  return (
    <div
      className={[
        'sf-view-cart-nudge pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] flex justify-center px-4',
        overProduct ? 'sf-view-cart-nudge--over-product' : 'z-40',
      ].join(' ')}
      role="status"
      aria-live="polite"
    >
      <div
        className={[
          'sf-view-cart-nudge-inner pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-white py-1 ps-1 pe-1 shadow-[0_8px_28px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/90',
          nudgePulse ? 'sf-nudge-pulse' : '',
        ].join(' ')}
      >
        <button
          id="sf-view-cart-nudge-btn"
          type="button"
          onClick={handleOpen}
          className="sf-view-cart-nudge-btn inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white transition active:scale-[0.98] sm:px-3.5 sm:text-[13px]"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
            boxShadow: `0 4px 14px ${accentAlpha(accent, 0.35)}`,
          }}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="truncate">{s.viewCart}</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label={s.close}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
