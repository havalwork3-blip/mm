import { Bell, ShoppingBag, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import {
  fetchOnlineOrderSoundEnabled,
  useOnlineOrderNotifications,
} from '../hooks/useOnlineOrderNotifications'
import { resolveActiveShopId } from '../lib/activeShop'

function formatUsd(raw: string): string {
  const n = Number.parseFloat(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}

export function OnlineOrderNotificationLayer() {
  const { t } = useLocale()
  const { me, canAccessShopData, shopImpersonation } = useSyncedSession()
  const shopId = resolveActiveShopId(me, shopImpersonation)
  const [soundEnabled, setSoundEnabled] = useState(true)

  const notifyEnabled = Boolean(
    me?.online_storefront_enabled && canAccessShopData && shopId != null,
  )

  useEffect(() => {
    if (!notifyEnabled) return
    const load = () => void fetchOnlineOrderSoundEnabled().then(setSoundEnabled)
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [notifyEnabled, shopId])

  const { toasts, dismissToast, pendingCount } = useOnlineOrderNotifications({
    enabled: notifyEnabled,
    shopId,
    soundEnabled,
  })

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), 12_000),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [toasts, dismissToast])

  if (!notifyEnabled) return null

  return (
    <>
      {pendingCount > 0 ? (
        <Link
          to="/online-orders"
          className="fixed bottom-4 end-4 z-[200] flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-700 sm:bottom-6 sm:end-6"
        >
          <Bell className="h-4 w-4" aria-hidden />
          <span>
            {pendingCount} {t('onlineOrders.status.PENDING')}
          </span>
        </Link>
      ) : null}

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[210] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-violet-200/80 bg-white/95 p-4 shadow-xl ring-1 ring-violet-100 backdrop-blur-md dark:border-violet-800/60 dark:bg-slate-900/95 dark:ring-violet-900/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <ShoppingBag className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t('onlineOrders.newOrderTitle').replace('{id}', String(toast.id))}
              </p>
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                {toast.customerName}
              </p>
              <p className="mt-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                ${formatUsd(toast.total)}
              </p>
              <Link
                to="/online-orders"
                onClick={() => dismissToast(toast.id)}
                className="mt-2 inline-block text-xs font-bold text-violet-600 hover:underline dark:text-violet-400"
              >
                {t('onlineOrders.viewOrder')} →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label={t('onlineOrders.closeDetails')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
