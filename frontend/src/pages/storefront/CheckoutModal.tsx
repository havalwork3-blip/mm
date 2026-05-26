import { CheckCircle2, ExternalLink, Loader2, MessageCircle, User, MapPin, Phone, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { submitPublicOrder, type StorefrontOrderResponse } from '../../api/storefrontApi'
import { ApiError } from '../../lib/api'
import {
  buildAddressFromCoords,
  googleMapsUrl,
  parseCoordsFromAddress,
  reverseGeocodeAddress,
  type GeoCoords,
} from '../../lib/geolocation'
import { useLocale } from '../../context/LocaleContext'
import {
  cartActiveLines,
  cartDeliveryFee,
  cartGrandTotal,
  cartSubtotal,
  parseDeliveryFreeMinUsd,
  useCartStore,
} from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { storefrontStrings } from './storefrontStrings'
import { useStorefrontPriceLabel } from './useStorefrontPriceLabel'
import { buildCustomerOrderWhatsAppUrl } from './storefrontOrderWhatsApp'
import { StorefrontBackButton } from './StorefrontBackButton'
import { StorefrontLocationMapPicker } from './StorefrontLocationMapPicker'
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
  const orderLines = cartActiveLines(lines)
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
  const [addressDetails, setAddressDetails] = useState('')
  const [coords, setCoords] = useState<GeoCoords | null>(null)
  const [coordsLabel, setCoordsLabel] = useState<string | null>(null)
  const [mapPreviewOpen, setMapPreviewOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<StorefrontOrderResponse | null>(null)

  const mapsLink = useMemo(() => {
    if (!coords) return null
    return googleMapsUrl(coords)
  }, [coords])

  const whatsappUrl = useMemo(() => {
    if (!placedOrder) return null
    const raw = appearance.contact_whatsapp?.trim() || appearance.contact_phone?.trim() || ''
    if (!raw) return null
    return buildCustomerOrderWhatsAppUrl(raw, placedOrder, lang)
  }, [placedOrder, appearance.contact_whatsapp, appearance.contact_phone, lang])

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
      setPlacedOrder(null)
      setSubmitting(false)
      setMapPreviewOpen(false)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedDetails = addressDetails.trim()
    const trimmedNotes = notes.trim()
    if (!trimmedName || !trimmedPhone) {
      setError(s.required)
      return
    }
    if (!coords) {
      setError(s.mapPickHint)
      return
    }
    if (hasZones && deliveryZoneId == null) {
      setError(s.deliveryAreaRequired)
      return
    }
    if (orderLines.length === 0) {
      setError(s.cartEmpty)
      return
    }
    if (shopId == null) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      const addressBlock = await buildAddressFromCoords(coords, lang, coordsLabel)
      const finalAddress = trimmedDetails ? `${trimmedDetails}\n\n${addressBlock}` : addressBlock
      const order = await submitPublicOrder({
        shop: shopId,
        customer_name: trimmedName,
        customer_phone: trimmedPhone,
        customer_address: finalAddress,
        customer_notes: trimmedNotes || undefined,
        delivery_zone_id: hasZones ? deliveryZoneId : undefined,
        items: orderLines.map((l) => ({ product: l.productId, quantity: l.quantity })),
      })
      clearCart()
      setName('')
      setPhone('')
      setAddressDetails('')
      setCoords(null)
      setCoordsLabel(null)
      setNotes('')
      setPlacedOrder(order)
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

  const hasMapPin = coords != null

  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pe-4 ps-11 text-base text-slate-800 outline-none transition focus:border-transparent focus:bg-white focus:ring-2'

  async function handlePickCoords(next: GeoCoords) {
    setError(null)
    setCoords(next)
    const label = await reverseGeocodeAddress(next, lang)
    setCoordsLabel(label)
    setMapPreviewOpen(true)
  }

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
          className="flex shrink-0 items-center gap-3 px-5 py-4 text-white"
          style={{ backgroundColor: accent }}
        >
          <StorefrontBackButton
            label={s.backToProducts}
            onClick={handleClose}
            variant="onAccent"
            accent={accent}
          />
          <h2 className="min-w-0 flex-1 truncate text-center text-lg font-bold">
            {success ? s.successTitle : s.checkout}
          </h2>
          <div className="w-[4.5rem] shrink-0 sm:w-[5.5rem]" aria-hidden />
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {success && placedOrder ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" strokeWidth={1.5} aria-hidden />
              <p className="max-w-sm text-sm text-slate-600">{s.successBody}</p>
              <p
                className="rounded-2xl px-4 py-2.5 text-base font-extrabold tabular-nums"
                style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
              >
                {s.orderNumber.replace('{id}', String(placedOrder.id))}
              </p>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl border-2 py-3 text-sm font-bold transition hover:bg-slate-50"
                  style={{ borderColor: accent, color: accent }}
                >
                  <MessageCircle className="h-5 w-5" aria-hidden />
                  {s.orderWhatsApp}
                </a>
              ) : null}
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 w-full max-w-sm rounded-2xl py-3 font-bold text-white"
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
                <div className="flex flex-col gap-2 text-sm">
                  <span className="font-medium text-slate-700">{s.customerAddress}</span>

                  <StorefrontLocationMapPicker
                    coords={coords}
                    onCoordsChange={(c) => void handlePickCoords(c)}
                    accent={accent}
                    disabled={submitting}
                    labels={{
                      mapPickHint: s.mapPickHint,
                      mapDragHint: s.mapDragHint,
                      locating: s.locating,
                      locationUnavailable: s.locationUnavailable,
                    }}
                  />

                  <div className="relative">
                    <MapPin
                      className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-slate-400"
                      aria-hidden
                    />
                    <textarea
                      value={addressDetails}
                      onChange={(e) => setAddressDetails(e.target.value)}
                      rows={3}
                      placeholder={s.addressDetailsPlaceholder}
                      autoComplete="street-address"
                      className={`${inputClass} resize-none`}
                      style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.35) }}
                      disabled={submitting}
                    />
                  </div>

                  {mapsLink ? (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                      style={{ color: accent }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      {s.openOnMap}
                    </a>
                  ) : null}
                </div>

                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">{s.customerNotes}</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder={s.customerNotesPlaceholder}
                    className={`${inputClass} resize-none ps-4`}
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
                  disabled={
                    submitting ||
                    orderLines.length === 0 ||
                    (hasZones && deliveryZoneId == null) ||
                    !hasMapPin
                  }
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

      {mapPreviewOpen && coords ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setMapPreviewOpen(false)}
            aria-label={s.close}
          />
          <div className="relative w-full max-w-[100%] overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-extrabold text-slate-900">Google Maps</p>
              <button
                type="button"
                onClick={() => setMapPreviewOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-100"
                aria-label={s.close}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="aspect-[4/3] w-full sm:aspect-[16/9]">
              <iframe
                title="Google Maps preview"
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${coords.lat},${coords.lon}&z=16&output=embed`}
              />
            </div>
            {mapsLink ? (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border-t border-slate-200 px-4 py-3 text-sm font-bold"
                style={{ color: accent }}
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {s.openOnMap}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
