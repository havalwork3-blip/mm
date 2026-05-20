import { PackageOpen } from 'lucide-react'

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
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={[
          'sf-product-card sf-card-shine group flex w-full flex-col overflow-hidden rounded-3xl bg-white text-start ring-1 transition duration-300 active:scale-[0.97]',
          available
            ? 'ring-slate-200/50 shadow-md hover:-translate-y-1.5 hover:shadow-xl'
            : 'sf-product-unavailable ring-slate-200/30 opacity-90 shadow-sm',
        ].join(' ')}
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className={[
                'h-full w-full object-cover transition duration-700',
                available ? 'group-hover:scale-110' : 'grayscale-[0.6] brightness-95',
              ].join(' ')}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <PackageOpen className="h-12 w-12" strokeWidth={1} aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          {!available ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <UnavailableProductBadge product={product} labels={labels} size="md" />
            </div>
          ) : null}
          {inCart > 0 && available ? (
            <span
              className="absolute start-2.5 top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              {inCart}
            </span>
          ) : null}
          <span
            className="absolute bottom-2.5 start-2.5 rounded-xl px-2.5 py-1 text-sm font-extrabold text-white shadow-md backdrop-blur-sm"
            style={{ backgroundColor: available ? accentAlpha(accent, 0.92) : 'rgba(100,116,139,0.85)' }}
          >
            {formatPrice(price, labels.usd)}
          </span>
        </div>
        <div className="space-y-1 p-3.5 pt-3">
          <h3
            className={[
              'line-clamp-2 text-[13px] font-bold leading-snug sm:text-sm',
              available ? 'text-slate-800' : 'text-slate-500',
            ].join(' ')}
          >
            {product.name}
          </h3>
          <p
            className={[
              'text-[11px] font-semibold',
              available ? '' : 'text-slate-400',
            ].join(' ')}
            style={available ? { color: accent } : undefined}
          >
            {available ? labels.viewProduct : unavailableLabel(product, labels)}
          </p>
        </div>
      </button>
    </li>
  )
}
