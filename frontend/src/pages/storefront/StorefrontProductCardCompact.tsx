import { PackageOpen } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable } from './productAvailability'
import { StorefrontFavoriteButton } from './StorefrontFavoriteButton'
import { accentAlpha } from './storefrontTheme'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'
import { useLocale } from '../../context/LocaleContext'

type Props = {
  shopId: number
  product: PublicStorefrontProduct
  accent: string
  onOpen: () => void
  addToFavorites: string
  removeFromFavorites: string
}

export function StorefrontProductCardCompact({
  shopId,
  product,
  accent,
  onOpen,
  addToFavorites,
  removeFromFavorites,
}: Props) {
  const { lang } = useLocale()
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)
  const discount = Number.parseFloat(String(product.online_discount_percent ?? 0))
  const onSale = Number.isFinite(discount) && discount > 0

  return (
    <li className="relative min-w-0">
      <StorefrontFavoriteButton
        shopId={shopId}
        productId={product.id}
        accent={accent}
        addLabel={addToFavorites}
        removeLabel={removeFromFavorites}
        className="absolute end-1.5 top-1.5 z-10 !h-7 !w-7"
      />
      <button
        type="button"
        onClick={onOpen}
        className={[
          'sf-product-card-compact group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-start ring-1 transition duration-300 active:scale-[0.98]',
          available
            ? 'ring-slate-200/60 shadow-sm hover:-translate-y-0.5 hover:shadow-md'
            : 'opacity-85 ring-slate-200/40',
        ].join(' ')}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
          {img ? (
            <img
              src={img}
              alt={product.name}
              className={[
                'h-full w-full object-cover transition duration-500',
                available ? 'group-hover:scale-105' : 'grayscale-[0.5]',
              ].join(' ')}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <PackageOpen className="h-8 w-8" strokeWidth={1} aria-hidden />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          {onSale && available ? (
            <span className="absolute start-1.5 top-1.5 rounded-md bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
              %
            </span>
          ) : null}
          <span
            className="absolute bottom-1.5 start-1.5 rounded-lg px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm"
            style={{ backgroundColor: available ? accentAlpha(accent, 0.9) : 'rgba(100,116,139,0.85)' }}
          >
            {formatPrice(price)}
          </span>
        </div>
        <p className="line-clamp-2 px-2 pb-2.5 pt-2 text-[11px] font-bold leading-snug text-slate-800">
          {product.name}
        </p>
      </button>
    </li>
  )
}
