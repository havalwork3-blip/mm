import { Check, PackageOpen, ShoppingCart } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { formatUsd } from './storefrontStrings'
import { accentAlpha } from './storefrontTheme'

function formatPrice(price: number, usdLabel: string): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  return `$${formatUsd(price)} ${usdLabel}`
}

type Props = {
  product: PublicStorefrontProduct
  accent: string
  inCart: number
  onAdd: () => void
  labels: { addToCart: string; inCart: string; added: string; usd: string }
}

export function StorefrontProductCard({ product, accent, inCart, onAdd, labels }: Props) {
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (!pulse) return
    const t = window.setTimeout(() => setPulse(false), 520)
    return () => window.clearTimeout(t)
  }, [pulse])

  function handleAdd() {
    onAdd()
    setPulse(true)
  }

  return (
    <li
      className={[
        'sf-product-card group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-shadow hover:shadow-md',
        pulse ? 'sf-cart-pop' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={handleAdd}
        className="relative aspect-[4/5] w-full overflow-hidden bg-slate-50 text-start"
        aria-label={inCart > 0 ? labels.inCart : labels.addToCart}
      >
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <PackageOpen className="h-10 w-10" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80"
          aria-hidden
        />
        {inCart > 0 ? (
          <span
            className="absolute start-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow"
            style={{ backgroundColor: accent }}
          >
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            ×{inCart}
          </span>
        ) : null}
        {pulse ? (
          <span
            className="sf-cart-ripple pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: accentAlpha(accent, 0.25) }}
            aria-hidden
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              <Check className="h-7 w-7" strokeWidth={3} />
            </span>
          </span>
        ) : null}
      </button>

      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug text-slate-800">
          {product.name}
        </h3>
        <p className="text-base font-bold" style={{ color: accent }}>
          {formatPrice(price, labels.usd)}
        </p>
        <button
          type="button"
          onClick={handleAdd}
          className={[
            'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.97]',
            inCart > 0 ? 'border-2 bg-white' : 'text-white shadow-md',
            pulse ? 'sf-btn-glow' : '',
          ].join(' ')}
          style={
            inCart > 0
              ? { borderColor: accent, color: accent, boxShadow: `0 4px 14px ${accentAlpha(accent, 0.2)}` }
              : {
                  backgroundColor: accent,
                  boxShadow: `0 6px 20px ${accentAlpha(accent, 0.35)}`,
                }
          }
        >
          {pulse ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              {labels.added}
            </>
          ) : inCart > 0 ? (
            <>
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {labels.inCart} ({inCart})
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {labels.addToCart}
            </>
          )}
        </button>
      </div>
    </li>
  )
}
