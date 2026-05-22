import { ChevronLeft, ChevronRight, Minus, PackageOpen, Plus, ShoppingBag } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { isProductAvailable } from './productAvailability'
import { triggerCartFly } from './cartFlyAnimation'
import { UnavailableProductBanner } from './UnavailableProductBadge'
import { useLocale } from '../../context/LocaleContext'
import { StorefrontFavoriteButton } from './StorefrontFavoriteButton'
import { StorefrontBackButton } from './StorefrontBackButton'
import { accentAlpha } from './storefrontTheme'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'

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
  productDetails: string
}

type Props = {
  shopId: number
  product: PublicStorefrontProduct
  categoryName: string
  accent: string
  inCart: number
  labels: Labels & {
    addToFavorites: string
    removeFromFavorites: string
  }
  onBack: () => void
  onAdd: (quantity: number) => void
}

export function StorefrontProductDetail({
  shopId,
  product,
  categoryName,
  accent,
  inCart,
  labels,
  onBack,
  onAdd,
}: Props) {
  const { lang } = useLocale()
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const mainImg = resolveMediaUrl(product.image_url)
  const galleryImgs = useMemo(
    () =>
      (product.gallery_image_urls ?? [])
        .map((u) => resolveMediaUrl(u))
        .filter((u): u is string => Boolean(u)),
    [product.gallery_image_urls],
  )
  const allImages = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const u of [mainImg, ...galleryImgs]) {
      if (!u || seen.has(u)) continue
      seen.add(u)
      out.push(u)
    }
    return out
  }, [mainImg, galleryImgs])

  const [activeImage, setActiveImage] = useState(0)
  const price = Number.parseFloat(product.sell_price)
  const available = isProductAvailable(product)
  const [qty, setQty] = useState(Math.max(1, inCart || 1))
  const [ordered, setOrdered] = useState(false)
  const orderBtnRef = useRef<HTMLButtonElement>(null)
  const description = (product.online_description || '').trim()

  useEffect(() => {
    setQty(Math.max(1, inCart || 1))
  }, [product.id, inCart])

  useEffect(() => {
    setOrdered(false)
    setActiveImage(0)
  }, [product.id])

  const activeSrc = allImages[activeImage] ?? null

  function handleOrder() {
    if (!available) return
    onAdd(qty)
    triggerCartFly(orderBtnRef.current, accent)
    setOrdered(true)
    window.setTimeout(() => setOrdered(false), 1600)
  }

  return (
    <div
      className="sf-product-sheet fixed inset-0 z-[110] flex flex-col bg-[#fafbfc]"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <header
        className="sf-product-sheet-header sf-glass-strong relative z-20 flex shrink-0 items-center gap-3 border-b border-white/60 px-4 py-3.5 pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <StorefrontBackButton
          label={labels.back}
          onClick={onBack}
          variant="accent"
          accent={accent}
          showLabel
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
          {categoryName ? (
            <p className="truncate text-xs text-slate-500">{categoryName}</p>
          ) : null}
        </div>
        <StorefrontFavoriteButton
          shopId={shopId}
          productId={product.id}
          accent={accent}
          addLabel={labels.addToFavorites}
          removeLabel={labels.removeFromFavorites}
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="relative mx-auto w-full max-w-lg">
          <div className="relative aspect-square w-full max-h-[min(55vh,420px)] bg-gradient-to-br from-slate-50 via-white to-[#faf8f5]">
            {activeSrc ? (
              <img
                src={activeSrc}
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
            {allImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImage((i) => (i <= 0 ? allImages.length - 1 : i - 1))
                  }
                  className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveImage((i) => (i >= allImages.length - 1 ? 0 : i + 1))
                  }
                  className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
                </button>
              </>
            ) : null}
          </div>
          {allImages.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {allImages.map((src, idx) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={[
                    'h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition',
                    idx === activeImage
                      ? 'border-slate-800 shadow-sm dark:border-white'
                      : 'border-transparent opacity-70 hover:opacity-100',
                  ].join(' ')}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
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
          <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-slate-900">
            {product.name}
          </h1>
          <p
            className={[
              'mt-3 text-3xl font-extrabold tracking-tight',
              !available ? 'text-slate-400 line-through' : '',
            ].join(' ')}
            style={available ? { color: accent } : undefined}
          >
            {formatPrice(price)}
          </p>
          {inCart > 0 && available ? (
            <p className="mt-2 text-sm font-medium text-slate-500">
              {labels.inCart}: <span style={{ color: accent }}>{inCart}</span>
            </p>
          ) : null}

          {description ? (
            <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
              <h2 className="mb-2 text-sm font-bold text-slate-800">{labels.productDetails}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            </section>
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

      <div className="sf-product-footer relative z-20 shrink-0 border-t border-slate-200/80 bg-white/95 p-4 shadow-[0_-8px_32px_rgba(15,23,42,0.08)] backdrop-blur-md pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
