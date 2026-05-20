import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { submitPublicOrder } from '../../api/storefrontApi'
import { ApiError } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { cartTotal, useCartStore } from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { formatUsd, storefrontStrings } from './storefrontStrings'

type Props = {
  open: boolean
  onClose: () => void
}

export function CheckoutModal({ open, onClose }: Props) {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId } = useStorefrontShop()
  const lines = useCartStore((st) => st.lines)
  const clearCart = useCartStore((st) => st.clearCart)
  const total = cartTotal(lines)

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
        aria-label={s.close}
      />

      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0f172a] p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={handleClose}
          disabled={submitting}
          className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
          aria-label={s.close}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" strokeWidth={1.5} aria-hidden />
            <h2 className="text-xl font-bold text-white">{s.successTitle}</h2>
            <p className="max-w-sm text-sm text-slate-400">{s.successBody}</p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full rounded-2xl bg-[#fbbf24] py-3 font-bold text-[#0f172a]"
            >
              {s.close}
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 pe-10 text-xl font-bold text-white">{s.checkout}</h2>
            <p className="mb-5 text-sm text-slate-400">
              {s.total}:{' '}
              <span className="font-semibold text-[#fde68a]">
                ${formatUsd(total)} {s.usd}
              </span>
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-slate-300">{s.customerName}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#fbbf24]/50 focus:ring-1 focus:ring-[#fbbf24]/30"
                  disabled={submitting}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-slate-300">{s.customerPhone}</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  dir="ltr"
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#fbbf24]/50 focus:ring-1 focus:ring-[#fbbf24]/30"
                  disabled={submitting}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-slate-300">{s.customerAddress}</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[#fbbf24]/50 focus:ring-1 focus:ring-[#fbbf24]/30"
                  disabled={submitting}
                />
              </label>

              {error ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting || lines.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-[#fbbf24] to-[#f59e0b] py-3.5 font-bold text-[#0f172a] disabled:cursor-not-allowed disabled:opacity-50"
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
  )
}
