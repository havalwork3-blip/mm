import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'

import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import {
  cartDeliveryFee,
  cartGrandTotal,
  cartItemCount,
  cartLineTotal,
  cartSubtotal,
  parseDeliveryFreeMinUsd,
  useCartStore,
} from '../../store/cartStore'
import { storefrontStrings } from './storefrontStrings'
import { accentAlpha } from './storefrontTheme'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'

type Props = {
  open: boolean
  accent: string
  onClose: () => void
  onCheckout: () => void
}

export function CartDrawer({ open, accent, onClose, onCheckout }: Props) {
  const { lang, isRtl } = useLocale()
  const s = storefrontStrings(lang)
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const { deliveryZones, appearance } = useStorefrontShop()
  const freeMin = parseDeliveryFreeMinUsd(appearance.delivery_free_min_usd)
  const lines = useCartStore((st) => st.lines)
  const deliveryZoneId = useCartStore((st) => st.deliveryZoneId)
  const setQuantity = useCartStore((st) => st.setQuantity)
  const removeItem = useCartStore((st) => st.removeItem)
  const setDeliveryZoneId = useCartStore((st) => st.setDeliveryZoneId)
  const subtotal = cartSubtotal(lines)
  const delivery = cartDeliveryFee(deliveryZones, deliveryZoneId, subtotal, freeMin)
  const grandTotal = cartGrandTotal(lines, deliveryZones, deliveryZoneId, freeMin)
  const qualifiesFree = freeMin != null && subtotal >= freeMin
  const remainingFree =
    freeMin != null && subtotal < freeMin ? Math.max(0, freeMin - subtotal) : 0
  const count = cartItemCount(lines)
  const hasActiveItems = count > 0
  const hasZones = deliveryZones.length > 0

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  function handleCheckout() {
    if (!hasActiveItems) return
    if (hasZones && deliveryZoneId == null) return
    onCheckout()
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={s.cart}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={s.close}
      />

      <aside
        className={[
          'relative flex h-full w-full max-w-full flex-col bg-white shadow-2xl sm:max-w-md md:max-w-lg lg:max-w-xl',
          isRtl ? 'ms-auto' : 'me-auto',
        ].join(' ')}
      >
        <div
          className="flex items-center justify-between px-4 py-4 text-white"
          style={{ backgroundColor: accent }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            <h2 className="text-lg font-bold">{s.cart}</h2>
            {count > 0 ? (
              <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-semibold">
                {count}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
            aria-label={s.close}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f5f5f7] px-4 py-3">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: accentAlpha(accent, 0.12) }}
              >
                <ShoppingBag className="h-8 w-8" style={{ color: accent }} strokeWidth={1.25} aria-hidden />
              </div>
              <p className="font-semibold text-slate-800">{s.cartEmpty}</p>
              <p className="text-sm text-slate-500">{s.cartEmptyHint}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => {
                const img = resolveMediaUrl(line.imageUrl)
                const inactive = line.quantity === 0
                return (
                  <li
                    key={line.productId}
                    className={[
                      'flex gap-3 rounded-2xl bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.05)] ring-1 ring-slate-100',
                      inactive ? 'opacity-60' : '',
                    ].join(' ')}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{line.name}</p>
                      <p className="mt-0.5 text-sm font-bold" style={{ color: accent }}>
                        {formatPrice(cartLineTotal(line))}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          aria-label={s.decrease}
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="min-w-[2ch] text-center text-sm font-semibold tabular-nums text-slate-800">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          aria-label={s.increase}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(line.productId)}
                          className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                          aria-label={s.remove}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4">
          {hasZones && hasActiveItems ? (
            <label className="mb-3 block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                {s.deliveryArea}
              </span>
              <select
                value={deliveryZoneId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setDeliveryZoneId(v === '' ? null : Number.parseInt(v, 10))
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base text-slate-800 outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.35) }}
              >
                <option value="">{s.selectDeliveryArea}</option>
                {deliveryZones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {formatPrice(Number.parseFloat(z.delivery_fee_usd) || 0)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {hasActiveItems ? (
            <div className="mb-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span>{s.subtotal}</span>
                <span className="font-semibold tabular-nums text-slate-700">
                  {formatPrice(subtotal)}
                </span>
              </div>
              {hasZones ? (
                <div className="flex items-center justify-between text-slate-500">
                  <span>{delivery === 0 && qualifiesFree ? s.deliveryFree : s.deliveryFee}</span>
                  <span
                    className={`font-semibold tabular-nums ${delivery === 0 && qualifiesFree ? 'text-emerald-600' : 'text-slate-700'}`}
                  >
                    {delivery === 0 && qualifiesFree ? formatPrice(0) : formatPrice(delivery)}
                  </span>
                </div>
              ) : null}
              {freeMin != null && hasActiveItems ? (
                <p className="text-xs text-slate-500">
                  {qualifiesFree
                    ? s.deliveryFree
                    : s.deliveryFreeRemaining.replace('{amount}', formatPrice(remainingFree))}
                </p>
              ) : null}
              {freeMin != null && !hasZones && hasActiveItems ? (
                <p className="text-xs text-slate-500">
                  {s.deliveryFreeHint.replace('{amount}', formatPrice(freeMin))}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">{s.total}</span>
            <span className="text-xl font-bold" style={{ color: accent }}>
              {formatPrice(hasActiveItems ? grandTotal : 0)}
            </span>
          </div>

          {hasZones && deliveryZoneId == null && hasActiveItems ? (
            <p className="mb-3 text-center text-xs text-amber-700">{s.deliveryAreaRequired}</p>
          ) : null}

          <button
            type="button"
            disabled={!hasActiveItems || (hasZones && deliveryZoneId == null)}
            onClick={handleCheckout}
            className="w-full rounded-2xl py-3.5 text-base font-bold text-white shadow-lg transition enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: accent,
              boxShadow: hasActiveItems ? `0 8px 24px ${accentAlpha(accent, 0.35)}` : undefined,
            }}
          >
            {s.proceedCheckout}
          </button>
        </div>
      </aside>
    </div>
  )
}
