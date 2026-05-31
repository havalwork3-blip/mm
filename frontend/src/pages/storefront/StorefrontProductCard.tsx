import { PackageOpen } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable, unavailableLabel } from './productAvailability'
import { UnavailableProductBadge } from './UnavailableProductBadge'
import { StorefrontAddToCartButton } from './StorefrontAddToCartButton'
import { StorefrontFavoriteButton } from './StorefrontFavoriteButton'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'
import { useLocale } from '../../context/LocaleContext'

type Props = {
  shopId: number
  product: PublicStorefrontProduct
  accent: string
  inCart: number
  onOpen: () => void
  onAddToCart: () => void
  labels: {
    viewProduct: string
    addToCart: string
    usd: string
    outOfStock: string
    discontinued: string
    unavailable: string
    addToFavorites: string
    removeFromFavorites: string
  }
}

export function StorefrontProductCard({
  shopId,
  product,
  accent,
  inCart,
  onOpen,
  onAddToCart,
  labels,
}: Props) {
  const { lang } = useLocale()
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)

  return (
    <li className="relative flex">
      <div
        className={[
          'sf-product-card group relative flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white transition duration-200',
          available
            ? 'border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]'
            : 'sf-product-unavailable border-slate-200/50 opacity-90',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onOpen}
          className="relative block w-full shrink-0 text-start active:scale-[0.99]"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-slate-50/80 p-3 sm:p-3.5">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className={[
                  'mx-auto h-full w-full object-contain transition duration-300',
                  available ? 'group-hover:scale-[1.03]' : 'grayscale-[0.45]',
                ].join(' ')}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <PackageOpen className="h-10 w-10" strokeWidth={1} aria-hidden />
              </div>
            )}
            {!available ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                <UnavailableProductBadge product={product} labels={labels} size="sm" />
              </div>
            ) : null}
            <StorefrontFavoriteButton
              shopId={shopId}
              productId={product.id}
              accent={accent}
              addLabel={labels.addToFavorites}
              removeLabel={labels.removeFromFavorites}
              className="absolute end-2 top-2 z-20 !h-8 !w-8 opacity-90"
            />
            {inCart > 0 && available ? (
              <span
                className="absolute start-2 top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: accent }}
              >
                {inCart}
              </span>
            ) : null}
          </div>
        </button>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5">
          <button type="button" onClick={onOpen} className="w-full text-start active:scale-[0.99]">
            <h3
              className={[
                'sf-product-card-title line-clamp-2 min-h-[2.35rem] text-[12px] font-semibold leading-snug sm:min-h-[2.5rem] sm:text-[13px]',
                available ? 'text-slate-800' : 'text-slate-500',
              ].join(' ')}
            >
              {product.name}
            </h3>
            <p
              className="mt-1.5 text-sm font-bold leading-none tracking-tight"
              style={{ color: available ? accent : '#94a3b8' }}
            >
              {formatPrice(price)}
            </p>
          </button>

          <div className="sf-product-card-actions mt-auto pt-2.5">
            {available ? (
              <StorefrontAddToCartButton
                accent={accent}
                label={labels.addToCart}
                inCart={inCart}
                onAdd={onAddToCart}
                imageUrl={img}
              />
            ) : (
              <p className="text-center text-[10px] font-medium text-slate-400">
                {unavailableLabel(product, labels)}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
