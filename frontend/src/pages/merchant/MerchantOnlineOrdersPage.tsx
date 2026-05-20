import {
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Phone,
  RefreshCw,
  User,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageAuthLoading } from '../../components/PageAuthLoading'
import { useLocale } from '../../context/LocaleContext'
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

function statusBadgeClass(status: StorefrontOrderStatus): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-900 ring-amber-200/80 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60'
    case 'PROCESSING':
      return 'bg-sky-100 text-sky-900 ring-sky-200/80 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800/60'
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-900 ring-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800/60'
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-700 ring-slate-300/80 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-600/60'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
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

  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === 'PENDING').length,
    [orders],
  )

  async function handleStatusChange(orderId: number, next: StorefrontOrderStatus) {
    setUpdatingId(orderId)
    setError(null)
    try {
      const updated = await patchMerchantStorefrontOrderStatus(orderId, next)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))
      if (detailOrder?.id === orderId) setDetailOrder(updated)
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
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
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
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            autoComplete="current-password"
          />
          {loginError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>
          ) : null}
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700"
          >
            {t('dash.signIn')}
          </button>
        </form>
      </div>
    )
  }

  if (needsShop) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <p className="text-sm text-amber-900 dark:text-amber-100">{t('inv.superuserShopHint')}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={shopOverride}
            onChange={(e) => setShopOverride(e.target.value)}
            aria-label={t('pos.shopIdAria')}
            placeholder={t('pos.shopIdPlaceholder')}
            className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-white"
          />
          <button
            type="button"
            onClick={() => {
              const v = shopOverride.trim()
              setShopImpersonation(v || null)
            }}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            {t('pos.apply')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="h-7 w-7 text-violet-600 dark:text-violet-400" aria-hidden />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {t('onlineOrders.title')}
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            {t('onlineOrders.subtitle')}
          </p>
          {pendingCount > 0 ? (
            <p className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              {pendingCount} {t('onlineOrders.status.PENDING')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>{t('onlineOrders.filterStatus')}</span>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | StorefrontOrderStatus)
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">{t('onlineOrders.filterAll')}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              aria-hidden
            />
            {t('onlineOrders.refresh')}
          </button>
        </div>
      </div>

      <Link
        to="/"
        className="inline-flex text-sm text-violet-600 hover:underline dark:text-violet-400"
      >
        <span className="inline-block rtl:rotate-180" aria-hidden>
          ←
        </span>{' '}
        {t('nav.backToHome')}
      </Link>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" aria-hidden />
          <span>{t('onlineOrders.loading')}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          {t('onlineOrders.empty')}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 md:block">
            <table className="w-full min-w-[900px] text-start text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colId')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colDate')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colCustomer')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colPhone')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colAddress')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colTotal')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colStatus')}</th>
                  <th className="px-4 py-3 font-semibold">{t('onlineOrders.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const expanded = expandedId === order.id
                  const busy = updatingId === order.id
                  return (
                    <OrderTableGroup
                      key={order.id}
                      order={order}
                      expanded={expanded}
                      busy={busy}
                      t={t}
                      statusLabel={statusLabel}
                      onToggle={() =>
                        setExpandedId((id) => (id === order.id ? null : order.id))
                      }
                      onStatusChange={(s) => void handleStatusChange(order.id, s)}
                      onOpenDetail={() => setDetailOrder(order)}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-3 md:hidden">
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
        </>
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
      className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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

function LineItemsTable({
  order,
  t,
}: {
  order: MerchantStorefrontOrderRow
  t: (k: string) => string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50">
      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('onlineOrders.lineItems')}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-t border-slate-200 text-slate-500 dark:border-slate-600 dark:text-slate-400">
            <th className="px-3 py-2 text-start font-medium">{t('onlineOrders.colProduct')}</th>
            <th className="px-3 py-2 text-start font-medium">{t('onlineOrders.colQty')}</th>
            <th className="px-3 py-2 text-start font-medium">
              {t('onlineOrders.colUnitPrice')}
            </th>
            <th className="px-3 py-2 text-start font-medium">
              {t('onlineOrders.colLineTotal')}
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((line) => (
            <tr
              key={line.id}
              className="border-t border-slate-100 dark:border-slate-700"
            >
              <td className="px-3 py-2 text-slate-800 dark:text-slate-200">
                {line.product_name}
              </td>
              <td className="px-3 py-2 tabular-nums">{line.quantity}</td>
              <td className="px-3 py-2 tabular-nums">${formatUsd(line.unit_price)}</td>
              <td className="px-3 py-2 tabular-nums font-medium">
                ${lineTotal(line.quantity, line.unit_price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrderTableGroup({
  order,
  expanded,
  busy,
  t,
  statusLabel,
  onToggle,
  onStatusChange,
  onOpenDetail,
}: {
  order: MerchantStorefrontOrderRow
  expanded: boolean
  busy: boolean
  t: (k: string) => string
  statusLabel: (s: StorefrontOrderStatus) => string
  onToggle: () => void
  onStatusChange: (s: StorefrontOrderStatus) => void
  onOpenDetail: () => void
}) {
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
        <td className="px-4 py-3 font-medium tabular-nums text-violet-700 dark:text-violet-300">
          #{order.id}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
          {formatDateTime(order.created_at)}
        </td>
        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
          {order.customer_name}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
          {order.customer_phone}
        </td>
        <td className="max-w-[12rem] truncate px-4 py-3 text-slate-600 dark:text-slate-400">
          {order.customer_address}
        </td>
        <td className="px-4 py-3 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          ${formatUsd(order.total_amount)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(order.status)}`}
          >
            {statusLabel(order.status)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <StatusSelect
              value={order.status}
              disabled={busy}
              onChange={onStatusChange}
              t={t}
              statusLabel={statusLabel}
            />
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  {t('onlineOrders.hideItems')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                  {t('onlineOrders.viewItems')}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenDetail}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {t('onlineOrders.detailsTitle').replace('{id}', String(order.id))}
            </button>
          </div>
          {busy ? (
            <span className="mt-1 block text-xs text-slate-500">
              {t('onlineOrders.statusUpdating')}
            </span>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
          <td colSpan={8} className="px-4 py-4">
            <LineItemsTable order={order} t={t} />
          </td>
        </tr>
      ) : null}
    </>
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
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
            #{order.id} · {formatDateTime(order.created_at)}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-white">
            <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {order.customer_name}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(order.status)}`}
        >
          {statusLabel(order.status)}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
        <p className="flex items-center gap-1.5" dir="ltr">
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {order.customer_phone}
        </p>
        <p>{order.customer_address}</p>
        <p className="text-base font-bold text-slate-900 dark:text-white">
          {t('onlineOrders.colTotal')}: ${formatUsd(order.total_amount)}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <StatusSelect
          value={order.status}
          disabled={busy}
          onChange={onStatusChange}
          t={t}
          statusLabel={statusLabel}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-sm font-medium text-violet-600 dark:text-violet-400"
          >
            {expanded ? t('onlineOrders.hideItems') : t('onlineOrders.viewItems')}
          </button>
          <button
            type="button"
            onClick={onOpenDetail}
            className="text-sm text-slate-500"
          >
            {t('onlineOrders.detailsTitle').replace('{id}', String(order.id))}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-4">
          <LineItemsTable order={order} t={t} />
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
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label={t('onlineOrders.closeDetails')}
      />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('onlineOrders.detailsTitle').replace('{id}', String(order.id))}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{formatDateTime(order.created_at)}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-slate-500">{t('onlineOrders.colCustomer')}</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {order.customer_name}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('onlineOrders.colPhone')}</dt>
            <dd dir="ltr" className="font-medium">
              {order.customer_phone}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('onlineOrders.colAddress')}</dt>
            <dd>{order.customer_address}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('onlineOrders.colTotal')}</dt>
            <dd className="text-lg font-bold">${formatUsd(order.total_amount)}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <label className="mb-1 block text-sm text-slate-500">
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
          <LineItemsTable order={order} t={t} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {t('onlineOrders.closeDetails')}
        </button>
      </div>
    </div>
  )
}
