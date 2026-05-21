import { CheckCircle2, Loader2, User, MapPin, Phone, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { submitPublicOrder } from '../../api/storefrontApi'
import { ApiError } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import {
  cartDeliveryFee,
  cartGrandTotal,
  cartSubtotal,
  parseDeliveryFreeMinUsd,
  useCartStore,
} from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { storefrontStrings } from './storefrontStrings'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'
import { accentAlpha } from './storefrontTheme'

type Props = {
  open: boolean
  accent: string
  onClose: () => void
}

export function CheckoutModal({ open, accent, onClose }: Props) {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { format: formatPrice } = useStorefrontPriceLabel(lang)
  const { shopId, deliveryZones, appearance } = useStorefrontShop()
  const freeMin = parseDeliveryFreeMinUsd(appearance.delivery_free_min_usd)
  const lines = useCartStore((st) => st.lines)
  const deliveryZoneId = useCartStore((st) => st.deliveryZoneId)
  const setDeliveryZoneId = useCartStore((st) => st.setDeliveryZoneId)
  const clearCart = useCartStore((st) => st.clearCart)
  const subtotal = cartSubtotal(lines)
  const delivery = cartDeliveryFee(deliveryZones, deliveryZoneId, subtotal, freeMin)
  const grandTotal = cartGrandTotal(lines, deliveryZones, deliveryZoneId, freeMin)
  const qualifiesFree = freeMin != null && subtotal >= freeMin
  const hasZones = deliveryZones.length > 0

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setError(null)
      setSuccess(false)
      setSubmitting(false)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedAddress = address.trim()
    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      setError(s.required)
      return
    }
    if (hasZones && deliveryZoneId == null) {
      setError(s.deliveryAreaRequired)
      return
    }
    if (lines.length === 0 || shopId == null) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      await submitPublicOrder({
        shop: shopId,
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_address: trimmedAddress,
        delivery_zone_id: hasZones ? deliveryZoneId : undefined,
        items: lines.map((l) => ({ product: l.productId, quantity: l.quantity })),
      })
      clearCart()
      setName('')
      setPhone('')
      setAddress('')
      setSuccess(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : s.orderError
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    if (submitting) return
    onClose()
  }

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-base text-slate-800 outline-none transition focus:border-transparent focus:bg-white focus:ring-2'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={handleClose}
        aria-label={s.close}
      />

      <div className="relative flex max-h-[92dvh] w-full max-w-[100%] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl md:max-w-xl lg:max-w-2xl">
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4 text-white"
          style={{ backgroundColor: accent }}
        >
          <h2 className="text-lg font-bold">{success ? s.successTitle : s.checkout}</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 disabled:opacity-50"
            aria-label={s.close}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" strokeWidth={1.5} aria-hidden />
              <p className="max-w-sm text-sm text-slate-600">{s.successBody}</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 w-full rounded-2xl py-3 font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {s.close}
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 space-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex justify-between">
                  <span>{s.subtotal}</span>
                  <span className="font-semibold tabular-nums" style={{ color: accent }}>
                    {formatPrice(subtotal)}
                  </span>
                </div>
                {hasZones ? (
                  <>
                    <label className="block pt-1">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">
                        {s.deliveryArea}
                      </span>
                      <select
                        value={deliveryZoneId ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setDeliveryZoneId(v === '' ? null : Number.parseInt(v, 10))
                        }}
                        disabled={submitting}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800"
                      >
                        <option value="">{s.selectDeliveryArea}</option>
                        {deliveryZones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} — {formatPrice(Number.parseFloat(z.delivery_fee_usd) || 0)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex justify-between">
                      <span>{delivery === 0 && qualifiesFree ? s.deliveryFree : s.deliveryFee}</span>
                      <span
                        className={`font-semibold tabular-nums ${delivery === 0 && qualifiesFree ? 'text-emerald-600' : ''}`}
                      >
                        {formatPrice(delivery)}
                      </span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
                  <span>{s.total}</span>
                  <span style={{ color: accent }}>{formatPrice(grandTotal)}</span>
                </div>
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
                <label className="relative flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">{s.customerName}</span>
                  <User className="pointer-events-none absolute start-3 top-[2.65rem] h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className={inputClass}
                    style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.35) }}
                    disabled={submitting}
                  />
                </label>
                <label className="relative flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">{s.customerPhone}</span>
                  <Phone className="pointer-events-none absolute start-3 top-[2.65rem] h-4 w-4 text-slate-400" aria-hidden />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    dir="ltr"
                    className={inputClass}
                    style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.35) }}
                    disabled={submitting}
                  />
                </label>
                <label className="relative flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">{s.customerAddress}</span>
                  <MapPin className="pointer-events-none absolute start-3 top-[2.65rem] h-4 w-4 text-slate-400" aria-hidden />
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.35) }}
                    disabled={submitting}
                  />
                </label>

                {error ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || lines.length === 0 || (hasZones && deliveryZoneId == null)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: accent,
                    boxShadow: `0 8px 24px ${accentAlpha(accent, 0.35)}`,
                  }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      {s.submitting}
                    </>
                  ) : (
                    s.submitOrder
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
