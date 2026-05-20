import { ArrowRight, Minus, PackageOpen, Plus, ShoppingBag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable } from './productAvailability'
import { triggerCartFly } from './cartFlyAnimation'
import { UnavailableProductBanner } from './UnavailableProductBadge'
import { formatUsd } from './storefrontStrings'
import { accentAlpha } from './storefrontTheme'

function formatPrice(price: number, usdLabel: string): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  return `$${formatUsd(price)} ${usdLabel}`
}

type Labels = {
  back: string
  orderNow: string
  added: string
  quantity: string
  usd: string
  inCart: string
  outOfStock: string
  discontinued: string
  unavailable: string
  unavailableHint: string
  cannotOrder: string
}

type Props = {
  product: PublicStorefrontProduct
  categoryName: string
  accent: string
  inCart: number
  labels: Labels
  onBack: () => void
  onAdd: (quantity: number) => void
}

export function StorefrontProductDetail({
  product,
  categoryName,
  accent,
  inCart,
  labels,
  onBack,
  onAdd,
}: Props) {
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)
  const [qty, setQty] = useState(Math.max(1, inCart || 1))
  const [ordered, setOrdered] = useState(false)
  const orderBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setQty(Math.max(1, inCart || 1))
  }, [product.id, inCart])

  useEffect(() => {
    setOrdered(false)
  }, [product.id])

  function handleOrder() {
    if (!available) return
    onAdd(qty)
    triggerCartFly(orderBtnRef.current, accent)
    setOrdered(true)
    window.setTimeout(() => setOrdered(false), 1600)
  }

  return (
    <div
      className="sf-product-sheet fixed inset-0 z-[70] flex flex-col bg-[#fafbfc]"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <header
        className="sf-glass-strong flex shrink-0 items-center gap-3 border-b border-white/60 px-4 py-3.5 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50"
          aria-label={labels.back}
        >
          <ArrowRight className="h-5 w-5 rotate-180 rtl:rotate-0" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
          {categoryName ? (
            <p className="truncate text-xs text-slate-500">{categoryName}</p>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative aspect-square w-full max-h-[min(55vh,420px)] bg-gradient-to-br from-slate-50 via-white to-[#faf8f5] sm:mx-auto sm:max-w-lg">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className={[
                'h-full w-full object-contain p-4',
                !available ? 'grayscale-[0.7] opacity-90' : '',
              ].join(' ')}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-300">
              <PackageOpen className="h-20 w-20" strokeWidth={1} aria-hidden />
            </div>
          )}
        </div>

        <div className="px-4 py-5 sm:mx-auto sm:max-w-lg">
          {categoryName ? (
            <span
              className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-bold"
              style={{ backgroundColor: accentAlpha(accent, 0.12), color: accent }}
            >
              {categoryName}
            </span>
          ) : null}
          <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-slate-900">{product.name}</h1>
          <p
            className={[
              'mt-3 text-3xl font-extrabold tracking-tight',
              !available ? 'text-slate-400 line-through' : '',
            ].join(' ')}
            style={available ? { color: accent } : undefined}
          >
            {formatPrice(price, labels.usd)}
          </p>
          {inCart > 0 && available ? (
            <p className="mt-2 text-sm font-medium text-slate-500">
              {labels.inCart}: <span style={{ color: accent }}>{inCart}</span>
            </p>
          ) : null}

          {!available ? (
            <div className="mt-5">
              <UnavailableProductBanner
                product={product}
                labels={labels}
                hint={labels.unavailableHint}
              />
            </div>
          ) : null}

          <div
            className={[
              'mt-6 flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70',
              !available ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <span className="text-sm font-semibold text-slate-600">{labels.quantity}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition active:scale-95"
                aria-label="-"
              >
                <Minus className="h-5 w-5" aria-hidden />
              </button>
              <span className="min-w-[2rem] text-center text-lg font-bold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((n) => n + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition active:scale-95"
                style={{ backgroundColor: accent }}
                aria-label="+"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/80 bg-white/95 p-4 backdrop-blur-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        {available ? (
          <button
            ref={orderBtnRef}
            type="button"
            onClick={handleOrder}
            className={[
              'sf-order-btn flex w-full items-center justify-center gap-2.5 rounded-3xl py-4.5 text-base font-extrabold text-white transition active:scale-[0.98] sm:mx-auto sm:max-w-lg',
              ordered ? 'sf-order-btn-success' : 'sf-order-btn-ready',
            ].join(' ')}
            style={{
              background: ordered
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : `linear-gradient(135deg, ${accent}, ${accent}dd)`,
              boxShadow: ordered
                ? '0 8px 24px rgba(16,185,129,0.4)'
                : `0 10px 32px ${accentAlpha(accent, 0.45)}`,
            }}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {ordered ? labels.added : labels.orderNow}
          </button>
        ) : (
          <div
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-base font-bold text-slate-500 sm:mx-auto sm:max-w-lg"
            role="status"
          >
            <ShoppingBag className="h-5 w-5 opacity-50" aria-hidden />
            {labels.cannotOrder}
          </div>
        )}
      </div>
    </div>
  )
}
