import { ChevronLeft, PackageOpen } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable, unavailableLabel } from './productAvailability'
import { UnavailableProductBadge } from './UnavailableProductBadge'
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
  onOpen: () => void
  labels: {
    viewProduct: string
    usd: string
    outOfStock: string
    discontinued: string
    unavailable: string
  }
}

export function StorefrontProductCard({ product, accent, inCart, onOpen, labels }: Props) {
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)

  return (
    <li className={!available ? 'opacity-95' : undefined}>
      <button
        type="button"
        onClick={onOpen}
        className={[
          'sf-product-card group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-start shadow-sm ring-1 transition duration-300 active:scale-[0.98]',
          available
            ? 'ring-slate-200/60 hover:-translate-y-1 hover:shadow-xl'
            : 'ring-slate-200/40 sf-product-unavailable',
        ].join(' ')}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-50">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className={[
                'h-full w-full object-cover transition duration-500',
                available ? 'group-hover:scale-105' : 'scale-100 grayscale-[0.65] brightness-90',
              ].join(' ')}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <PackageOpen className="h-10 w-10" strokeWidth={1.25} aria-hidden />
            </div>
          )}
          <div
            className={[
              'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent',
              !available ? 'from-black/70' : '',
            ].join(' ')}
          />
          {!available ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px]">
              <UnavailableProductBadge product={product} labels={labels} size="md" />
            </div>
          ) : null}
          {inCart > 0 && available ? (
            <span
              className="absolute start-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow"
              style={{ backgroundColor: accent }}
            >
              ×{inCart}
            </span>
          ) : null}
          <span
            className="absolute bottom-2 end-2 flex items-center gap-0.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm backdrop-blur-sm"
          >
            {labels.viewProduct}
            <ChevronLeft className="h-3 w-3 rotate-180 rtl:rotate-0" aria-hidden />
          </span>
        </div>
        <div className="flex flex-col gap-1 p-3">
          <h3
            className={[
              'line-clamp-2 text-sm font-semibold leading-snug',
              available ? 'text-slate-800' : 'text-slate-500',
            ].join(' ')}
          >
            {product.name}
          </h3>
          <p
            className={['text-base font-bold', !available ? 'text-slate-400 line-through decoration-slate-300' : ''].join(' ')}
            style={available ? { color: accent } : undefined}
          >
            {formatPrice(price, labels.usd)}
          </p>
          <span
            className="mt-0.5 w-fit rounded-lg px-2 py-0.5 text-[10px] font-semibold"
            style={
              available
                ? { backgroundColor: accentAlpha(accent, 0.1), color: accent }
                : { backgroundColor: 'rgba(100,116,139,0.12)', color: '#64748b' }
            }
          >
            {available ? labels.viewProduct : unavailableLabel(product, labels)}
          </span>
        </div>
      </button>
    </li>
  )
}
