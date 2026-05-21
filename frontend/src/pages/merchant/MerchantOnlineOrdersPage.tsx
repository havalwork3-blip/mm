import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageAuthLoading } from '../../components/PageAuthLoading'
import { useLocale } from '../../context/LocaleContext'
import { notifyOnlineOrdersChanged } from '../../hooks/useOnlineOrdersPendingCount'
import { useSyncedSession } from '../../hooks/useSyncedSession'
import {
  fetchMerchantStorefrontOrders,
  patchMerchantStorefrontOrderStatus,
} from '../../lib/merchantStorefrontApi'
import type {
  MerchantStorefrontOrderRow,
  StorefrontOrderStatus,
} from '../../types/api'

const STATUSES: StorefrontOrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateTime(value: string | undefined | null): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`
}

function formatUsd(raw: string | undefined | null): string {
  if (raw == null || String(raw).trim() === '') return '0'
  const n = Number.parseFloat(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}

function lineTotal(qty: number, unitPrice: string): string {
  const u = Number.parseFloat(unitPrice)
  if (!Number.isFinite(u)) return '0'
  return formatUsd(String(qty * u))
}

function statusTheme(status: StorefrontOrderStatus): {
  badge: string
  icon: typeof Clock
} {
  switch (status) {
    case 'PENDING':
      return {
        badge:
          'bg-amber-50 text-amber-900 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50',
        icon: Clock,
      }
    case 'PROCESSING':
      return {
        badge:
          'bg-sky-50 text-sky-900 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50',
        icon: Package,
      }
    case 'COMPLETED':
      return {
        badge:
          'bg-emerald-50 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50',
        icon: CheckCircle2,
      }
    case 'CANCELLED':
      return {
        badge:
          'bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-600/50',
        icon: XCircle,
      }
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: Clock,
      }
  }
}

export function MerchantOnlineOrdersPage() {
  const { t } = useLocale()
  const {
    me,
    authPending,
    showLogin,
    login,
    canAccessShopData,
    needsShop,
    shopImpersonation,
    setShopImpersonation,
  } = useSyncedSession()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopOverride, setShopOverride] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)

  const [orders, setOrders] = useState<MerchantStorefrontOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | StorefrontOrderStatus>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailOrder, setDetailOrder] = useState<MerchantStorefrontOrderRow | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  useEffect(() => {
    setShopOverride(shopImpersonation ?? '')
  }, [shopImpersonation])

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchMerchantStorefrontOrders()
      setOrders(rows)
      notifyOnlineOrdersChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onlineOrders.loadError'))
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void loadOrders()
  }, [me, canAccessShopData, loadOrders])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const counts = useMemo(() => {
    const c: Record<'all' | StorefrontOrderStatus, number> = {
      all: orders.length,
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    }
    for (const o of orders) c[o.status] += 1
    return c
  }, [orders])

  async function handleStatusChange(orderId: number, next: StorefrontOrderStatus) {
    setUpdatingId(orderId)
    setError(null)
    try {
      const updated = await patchMerchantStorefrontOrderStatus(orderId, next)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      if (detailOrder?.id === orderId) setDetailOrder(updated)
      notifyOnlineOrdersChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('onlineOrders.statusUpdateError'))
    } finally {
      setUpdatingId(null)
    }
  }

  function statusLabel(status: StorefrontOrderStatus): string {
    return t(`onlineOrders.status.${status}`)
  }

  if (authPending) return <PageAuthLoading />

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('onlineOrders.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('dash.signIn')}</p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            setLoginError(null)
            void login(email, password).catch((err: unknown) => {
              setLoginError(err instanceof Error ? err.message : String(err))
            })
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            autoComplete="current-password"
          />
          {loginError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-xl bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-700"
          >
            {t('dash.signIn')}
          </button>
        </form>
      </div>
    )
  }

  if (me && !me.online_storefront_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <ShoppingBag className="mx-auto h-12 w-12 text-slate-300" aria-hidden />
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
          {t('onlineOrders.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {t('onlineOrders.notEnabled')}
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t('nav.dashboard')}
        </Link>
      </div>
    )
  }

  if (needsShop) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm text-amber-900 dark:text-amber-100">{t('inv.superuserShopHint')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={shopOverride}
            onChange={(e) => setShopOverride(e.target.value)}
            aria-label={t('pos.shopIdAria')}
            placeholder={t('pos.shopIdPlaceholder')}
            className="w-28 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={() => {
              const v = shopOverride.trim()
              setShopImpersonation(v || null)
            }}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {t('pos.apply')}
          </button>
        </div>
      </div>
    )
  }

  const filterOptions: { key: 'all' | StorefrontOrderStatus; label: string }[] = [
    { key: 'all', label: t('onlineOrders.filterAll') },
    ...STATUSES.map((s) => ({ key: s, label: statusLabel(s) })),
  ]

  return (
    <div className="mx-auto w-full max-w-[100%] space-y-6 px-4 pb-10 sm:px-6 md:max-w-6xl md:px-8 xl:max-w-7xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-500 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              {t('onlineOrders.heroBadge')}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t('onlineOrders.title')}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/90">{t('onlineOrders.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              {t('onlineOrders.refresh')}
            </button>
            <Link
              to="/online-shop"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-700 shadow-md transition hover:bg-white/95"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t('nav.onlineShop')}
            </Link>
          </div>
        </div>
        <div
          className="pointer-events-none absolute -end-10 -top-10 h-44 w-44 rounded-full bg-white/10"
          aria-hidden
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {STATUSES.map((status) => {
          const theme = statusTheme(status)
          const Icon = theme.icon
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={[
                'rounded-2xl border bg-white p-4 text-start shadow-sm transition dark:bg-slate-900',
                statusFilter === status
                  ? 'border-violet-300 ring-2 ring-violet-400/30 dark:border-violet-600'
                  : 'border-slate-200/80 hover:border-violet-200 dark:border-slate-700 dark:hover:border-violet-800',
              ].join(' ')}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${theme.badge}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {counts[status]}
                </span>
              </span>
              <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {statusLabel(status)}
              </p>
            </button>
          )
        })}
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={[
                'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',
                statusFilter === key
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800',
              ].join(' ')}
            >
              {label}
              <span
                className={[
                  'ms-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                  statusFilter === key
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
                ].join(' ')}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('onlineOrders.showingCount').replace('{n}', String(filtered.length))}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-20 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden />
          <span className="text-sm font-medium text-slate-500">{t('onlineOrders.loading')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ShoppingBag className="h-12 w-12 text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {t('onlineOrders.empty')}
          </p>
          <Link
            to="/online-shop"
            className="text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
          >
            {t('nav.onlineShop')} →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {filtered.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={updatingId === order.id}
              expanded={expandedId === order.id}
              t={t}
              statusLabel={statusLabel}
              onToggleExpand={() =>
                setExpandedId((id) => (id === order.id ? null : order.id))
              }
              onStatusChange={(s) => void handleStatusChange(order.id, s)}
              onOpenDetail={() => setDetailOrder(order)}
            />
          ))}
        </ul>
      )}

      {detailOrder ? (
        <OrderDetailModal
          order={detailOrder}
          busy={updatingId === detailOrder.id}
          t={t}
          statusLabel={statusLabel}
          onClose={() => setDetailOrder(null)}
          onStatusChange={(s) => void handleStatusChange(detailOrder.id, s)}
        />
      ) : null}
    </div>
  )
}

function StatusBadge({
  status,
  statusLabel,
}: {
  status: StorefrontOrderStatus
  statusLabel: (s: StorefrontOrderStatus) => string
}) {
  const theme = statusTheme(status)
  const Icon = theme.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${theme.badge}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {statusLabel(status)}
    </span>
  )
}

function StatusSelect({
  value,
  disabled,
  onChange,
  t,
  statusLabel,
}: {
  value: StorefrontOrderStatus
  disabled: boolean
  onChange: (s: StorefrontOrderStatus) => void
  t: (k: string) => string
  statusLabel: (s: StorefrontOrderStatus) => string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as StorefrontOrderStatus)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 sm:max-w-[11rem]"
      aria-label={t('onlineOrders.updateStatus')}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {statusLabel(s)}
        </option>
      ))}
    </select>
  )
}

function LineItemsBlock({
  order,
  t,
}: {
  order: MerchantStorefrontOrderRow
  t: (k: string) => string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {t('onlineOrders.lineItems')} ({order.items.length})
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {order.items.map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {line.product_name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {line.quantity} × ${formatUsd(line.unit_price)}
              </p>
            </div>
            <p className="shrink-0 text-base font-bold tabular-nums text-slate-900 dark:text-white">
              ${lineTotal(line.quantity, line.unit_price)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function OrderCard({
  order,
  busy,
  expanded,
  t,
  statusLabel,
  onToggleExpand,
  onStatusChange,
  onOpenDetail,
}: {
  order: MerchantStorefrontOrderRow
  busy: boolean
  expanded: boolean
  t: (k: string) => string
  statusLabel: (s: StorefrontOrderStatus) => string
  onToggleExpand: () => void
  onStatusChange: (s: StorefrontOrderStatus) => void
  onOpenDetail: () => void
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-violet-100 px-2.5 py-1 text-sm font-extrabold tabular-nums text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
              #{order.id}
            </span>
            <StatusBadge status={order.status} statusLabel={statusLabel} />
            <span className="text-xs font-medium text-slate-400">
              {formatDateTime(order.created_at)}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <User className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
              {order.customer_name}
            </p>
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300" dir="ltr">
              <Phone className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
              <a href={`tel:${order.customer_phone}`} className="hover:underline">
                {order.customer_phone}
              </a>
            </p>
          </div>

          <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
            <span className="line-clamp-2">{order.customer_address}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end sm:text-end">
          {order.delivery_zone_name ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('onlineOrders.deliveryArea')}: {order.delivery_zone_name}
            </p>
          ) : null}
          {order.subtotal_amount != null && String(order.subtotal_amount).trim() !== '' ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>{t('onlineOrders.colSubtotal')}: </span>
              <span className="font-semibold tabular-nums">${formatUsd(order.subtotal_amount)}</span>
              {order.delivery_fee != null && Number.parseFloat(order.delivery_fee) > 0 ? (
                <>
                  <span className="mx-1">·</span>
                  <span>{t('onlineOrders.colDelivery')}: </span>
                  <span className="font-semibold tabular-nums">${formatUsd(order.delivery_fee)}</span>
                </>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('onlineOrders.colTotal')}
            </p>
            <p className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
              ${formatUsd(order.total_amount)}
            </p>
          </div>
          <StatusSelect
            value={order.status}
            disabled={busy}
            onChange={onStatusChange}
            t={t}
            statusLabel={statusLabel}
          />
          {busy ? (
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500 sm:justify-end">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('onlineOrders.statusUpdating')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              {t('onlineOrders.hideItems')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              {t('onlineOrders.viewItems')}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenDetail}
          className="rounded-xl px-3.5 py-2 text-xs font-bold text-violet-600 transition hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
        >
          {t('onlineOrders.detailsTitle').replace('{id}', String(order.id))}
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 sm:px-5 sm:pb-5">
          <LineItemsBlock order={order} t={t} />
        </div>
      ) : null}
    </li>
  )
}

function OrderDetailModal({
  order,
  busy,
  t,
  statusLabel,
  onClose,
  onStatusChange,
}: {
  order: MerchantStorefrontOrderRow
  busy: boolean
  t: (k: string) => string
  statusLabel: (s: StorefrontOrderStatus) => string
  onClose: () => void
  onStatusChange: (s: StorefrontOrderStatus) => void
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('onlineOrders.closeDetails')}
      />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-3xl">
        <div className="shrink-0 bg-gradient-to-br from-violet-600 to-indigo-500 px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-white/80">{formatDateTime(order.created_at)}</p>
              <h2 className="mt-1 text-xl font-bold">
                {t('onlineOrders.detailsTitle').replace('{id}', String(order.id))}
              </h2>
            </div>
            <StatusBadge status={order.status} statusLabel={statusLabel} />
          </div>
          {order.delivery_zone_name ? (
            <p className="mt-2 text-sm text-white/90">
              {t('onlineOrders.deliveryArea')}: {order.delivery_zone_name}
            </p>
          ) : null}
          {order.subtotal_amount != null && String(order.subtotal_amount).trim() !== '' ? (
            <p className="mt-2 text-sm text-white/80">
              {t('onlineOrders.colSubtotal')}: ${formatUsd(order.subtotal_amount)}
              {order.delivery_fee != null && Number.parseFloat(order.delivery_fee) > 0
                ? ` · ${t('onlineOrders.colDelivery')}: $${formatUsd(order.delivery_fee)}`
                : ''}
            </p>
          ) : null}
          <p className="mt-3 text-3xl font-extrabold tabular-nums">
            ${formatUsd(order.total_amount)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('onlineOrders.colCustomer')}
              </dt>
              <dd className="mt-1 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <User className="h-4 w-4 text-violet-500" aria-hidden />
                {order.customer_name}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('onlineOrders.colPhone')}
              </dt>
              <dd className="mt-1 font-semibold" dir="ltr">
                <a href={`tel:${order.customer_phone}`} className="text-violet-600 hover:underline dark:text-violet-400">
                  {order.customer_phone}
                </a>
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('onlineOrders.colAddress')}
              </dt>
              <dd className="mt-1 text-slate-700 dark:text-slate-200">{order.customer_address}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('onlineOrders.updateStatus')}
            </label>
            <StatusSelect
              value={order.status}
              disabled={busy}
              onChange={onStatusChange}
              t={t}
              statusLabel={statusLabel}
            />
          </div>

          <div className="mt-4">
            <LineItemsBlock order={order} t={t} />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t('onlineOrders.closeDetails')}
          </button>
        </div>
      </div>
    </div>
  )
}
