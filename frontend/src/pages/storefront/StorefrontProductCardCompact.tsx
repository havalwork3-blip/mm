import { PackageOpen, Plus } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable } from './productAvailability'
import { triggerCartFly } from './cartFlyAnimation'
import { StorefrontFavoriteButton } from './StorefrontFavoriteButton'
import { accentAlpha } from './storefrontTheme'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'
import { useLocale } from '../../context/LocaleContext'
import { useRef, type MouseEvent } from 'react'

type Props = {
  shopId: number
  product: PublicStorefrontProduct
  accent: string
  inCart: number
  onOpen: () => void
  onAddToCart: () => void
  addToCart: string
  addToFavorites: string
  removeFromFavorites: string
  className?: string
}

export function StorefrontProductCardCompact({
  shopId,
  product,
  accent,
  inCart,
  onOpen,
  onAddToCart,
  addToCart,
  addToFavorites,
  removeFromFavorites,
  className = '',
}: Props) {
  const { lang } = useLocale()
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const addRef = useRef<HTMLButtonElement>(null)
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)
  const discount = Number.parseFloat(String(product.online_discount_percent ?? 0))
  const onSale = Number.isFinite(discount) && discount > 0

  function handleAdd(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onAddToCart()
    triggerCartFly(addRef.current, accent)
  }

  return (
    <li className={['relative min-w-0', className].join(' ')}>
      <article
        className={[
          'sf-product-card-compact flex h-full flex-col overflow-hidden rounded-2xl bg-white transition duration-300',
          available
            ? 'shadow-[0_2px_12px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/50 hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)] hover:-translate-y-0.5'
            : 'opacity-80 ring-1 ring-slate-200/40',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onOpen}
          className="relative block w-full text-start active:scale-[0.99]"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-b from-slate-50 to-white p-2.5">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className={[
                  'mx-auto h-full w-full rounded-xl object-contain transition duration-500',
                  available ? 'group-hover:scale-[1.03]' : 'grayscale-[0.45]',
                ].join(' ')}
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-100 text-slate-300">
                <PackageOpen className="h-9 w-9" strokeWidth={1} aria-hidden />
              </div>
            )}
            {onSale && available ? (
              <span className="absolute start-2 top-2 z-10 rounded-lg bg-rose-500 px-1.5 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
                -{Math.round(discount)}%
              </span>
            ) : null}
            <StorefrontFavoriteButton
              shopId={shopId}
              productId={product.id}
              accent={accent}
              addLabel={addToFavorites}
              removeLabel={removeFromFavorites}
              className="absolute end-2 top-2 z-20 !h-8 !w-8 !rounded-xl !bg-white/95 !shadow-sm !ring-1 !ring-slate-200/80"
            />
          </div>
        </button>

        <div className="flex flex-1 flex-col gap-2 px-2.5 pb-2.5 pt-1">
          <button type="button" onClick={onOpen} className="min-h-0 flex-1 text-start">
            <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-800">
              {product.name}
            </p>
            <p
              className="mt-1 text-[13px] font-extrabold tracking-tight"
              style={{ color: available ? accent : '#64748b' }}
            >
              {formatPrice(price)}
            </p>
          </button>

          {available ? (
            <button
              ref={addRef}
              type="button"
              onClick={handleAdd}
              className="sf-add-cart-btn flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-extrabold text-white shadow-sm transition active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
                boxShadow: `0 4px 12px ${accentAlpha(accent, 0.3)}`,
              }}
              aria-label={addToCart}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              {inCart > 0 ? `${addToCart} (${inCart})` : addToCart}
            </button>
          ) : null}
        </div>
      </article>
    </li>
  )
}
