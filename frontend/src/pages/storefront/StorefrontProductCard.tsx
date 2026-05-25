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
      <StorefrontFavoriteButton
        shopId={shopId}
        productId={product.id}
        accent={accent}
        addLabel={labels.addToFavorites}
        removeLabel={labels.removeFromFavorites}
        className="absolute end-2 top-2 z-20"
      />
      <div
        className={[
          'sf-product-card sf-card-shine relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white ring-1 transition duration-300',
          available
            ? 'ring-slate-200/50 shadow-[0_2px_10px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
            : 'sf-product-unavailable ring-slate-200/30 opacity-90 shadow-sm',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onOpen}
          className="block w-full shrink-0 text-start active:scale-[0.99]"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-slate-50 to-white p-2.5 sm:p-3">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className={[
                  'mx-auto h-full w-full rounded-lg object-contain transition duration-500',
                  available ? 'group-hover:scale-[1.02]' : 'grayscale-[0.45]',
                ].join(' ')}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <PackageOpen className="h-10 w-10" strokeWidth={1} aria-hidden />
              </div>
            )}
            {!available ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
                <UnavailableProductBadge product={product} labels={labels} size="sm" />
              </div>
            ) : null}
            {inCart > 0 && available ? (
              <span
                className="absolute start-2 top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white shadow"
                style={{ backgroundColor: accent }}
              >
                {inCart}
              </span>
            ) : null}
          </div>
        </button>

        <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
          <button type="button" onClick={onOpen} className="w-full text-start active:scale-[0.99]">
            <h3
              className={[
                'sf-product-card-title line-clamp-2 min-h-[2.4rem] text-[12px] font-bold leading-snug sm:min-h-[2.55rem] sm:text-[13px]',
                available ? 'text-slate-800' : 'text-slate-500',
              ].join(' ')}
            >
              {product.name}
            </h3>
            <p
              className="mt-1 text-[11px] font-extrabold leading-none"
              style={{ color: available ? accent : '#94a3b8' }}
            >
              {formatPrice(price)}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
              {available ? labels.viewProduct : unavailableLabel(product, labels)}
            </p>
          </button>

          <div className="sf-product-card-actions mt-auto pt-2">
            {available ? (
              <StorefrontAddToCartButton
                accent={accent}
                label={labels.addToCart}
                inCart={inCart}
                onAdd={onAddToCart}
                imageUrl={img}
              />
            ) : (
              <div className="h-8 sm:h-9" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </li>
  )
}
