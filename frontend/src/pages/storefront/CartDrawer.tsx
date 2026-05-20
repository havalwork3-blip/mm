import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'

import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import {
  cartItemCount,
  cartLineTotal,
  cartTotal,
  useCartStore,
} from '../../store/cartStore'
import { formatUsd, storefrontStrings } from './storefrontStrings'

type Props = {
  open: boolean
  onClose: () => void
  onCheckout: () => void
}

export function CartDrawer({ open, onClose, onCheckout }: Props) {
  const { lang, isRtl } = useLocale()
  const s = storefrontStrings(lang)
  const lines = useCartStore((st) => st.lines)
  const setQuantity = useCartStore((st) => st.setQuantity)
  const removeItem = useCartStore((st) => st.removeItem)
  const total = cartTotal(lines)
  const count = cartItemCount(lines)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={s.cart}>
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={s.close}
      />

      <aside
        className={[
          'relative flex h-full w-full max-w-md flex-col border-white/10 bg-[#0f172a] shadow-2xl',
          isRtl ? 'ms-auto border-s' : 'me-auto border-e',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[#fbbf24]" aria-hidden />
            <h2 className="text-lg font-semibold text-white">{s.cart}</h2>
            {count > 0 ? (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                {count}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label={s.close}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ShoppingBag className="h-12 w-12 text-slate-600" strokeWidth={1.25} aria-hidden />
              <p className="font-medium text-slate-300">{s.cartEmpty}</p>
              <p className="text-sm text-slate-500">{s.cartEmptyHint}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => {
                const img = resolveMediaUrl(line.imageUrl)
                return (
                  <li
                    key={line.productId}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">{line.name}</p>
                      <p className="mt-0.5 text-sm text-[#fde68a]">
                        ${formatUsd(cartLineTotal(line))} {s.usd}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          aria-label={s.decrease}
                        >
                          <Minus className="h-4 w-4" aria-hidden />
                        </button>
                        <span className="min-w-[2ch] text-center text-sm font-medium tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          aria-label={s.increase}
                        >
                          <Plus className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(line.productId)}
                          className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
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

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-slate-400">{s.total}</span>
            <span className="text-xl font-bold text-[#fde68a]">
              ${formatUsd(total)} {s.usd}
            </span>
          </div>
          <button
            type="button"
            disabled={lines.length === 0}
            onClick={onCheckout}
            className="w-full rounded-2xl bg-gradient-to-l from-[#fbbf24] to-[#f59e0b] py-3.5 text-base font-bold text-[#0f172a] shadow-lg shadow-amber-500/20 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.proceedCheckout}
          </button>
        </div>
      </aside>
    </div>
  )
}
