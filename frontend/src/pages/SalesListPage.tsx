import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { SaleListRow } from '../components/sales/SaleListRow'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { resolveActiveShopId } from '../lib/activeShop'
import { apiJson, type ApiFetchOptions } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import { withReceiptPrefs } from '../lib/receiptPrefs'
import { digitsOnlyAscii } from '../lib/shopReceiptNumbers'
import { useSalesListStore } from '../stores/salesListStore'
import type {
  CustomerRow,
  Paginated,
  ProductRow,
  ReceiptSettingsRow,
  SaleListRow as SaleRow,
} from '../types/api'

type PaymentStatusFilter = 'all' | 'debt' | 'paid'
type DiscountFilter = 'all' | 'with_discount'

type SalesListFilters = {
  productName: string
  customerName: string
  customerId: number | null
  receiptNumber: string
  dateFrom: string
  dateTo: string
  paymentStatus: PaymentStatusFilter
  discountFilter: DiscountFilter
}

/** Tenant APIs: always send active `pos_shop_id` (even when Global View is on). */
const SHOP_SCOPED: ApiFetchOptions = { shopScoped: true }

const EMPTY_FILTERS: SalesListFilters = {
  productName: '',
  customerName: '',
  customerId: null,
  receiptNumber: '',
  dateFrom: '',
  dateTo: '',
  paymentStatus: 'all',
  discountFilter: 'all',
}

function buildSalesQuery(filters: SalesListFilters): string {
  const params = new URLSearchParams()
  if (filters.productName) params.set('product_name', filters.productName)
  if (filters.customerId != null) {
    params.set('customer', String(filters.customerId))
  } else if (filters.customerName) {
    params.set('customer_name', filters.customerName)
  }
  const receiptDigits = digitsOnlyAscii(filters.receiptNumber)
  if (receiptDigits) params.set('receipt_number', receiptDigits)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.paymentStatus !== 'all') {
    params.set('payment_status', filters.paymentStatus)
  }
  if (filters.discountFilter === 'with_discount') {
    params.set('has_discount', '1')
  }
  const qs = params.toString()
  return qs ? `/api/sales/?${qs}` : '/api/sales/'
}

export function SalesListPage() {
  const { t } = useLocale()
  const {
    me,
    authPending,
    showLogin,
    login,
    shopImpersonation,
    setShopImpersonation,
    canAccessShopData,
    needsShop,
  } = useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopOverride, setShopOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<SalesListFilters>(EMPTY_FILTERS)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettingsRow | null>(null)
  const [debouncedProductQ, setDebouncedProductQ] = useState('')
  const [debouncedCustomerQ, setDebouncedCustomerQ] = useState('')
  const [productHits, setProductHits] = useState<ProductRow[]>([])
  const [customerHits, setCustomerHits] = useState<CustomerRow[]>([])
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)

  const setSaleItems = useSalesListStore((s) => s.setItems)
  const resetSales = useSalesListStore((s) => s.reset)
  const saleItems = useSalesListStore((s) => s.items)

  const activeShopId = useMemo(
    () => resolveActiveShopId(me, shopImpersonation),
    [me, shopImpersonation],
  )

  const salesForActiveShop = useCallback(
    (items: SaleRow[]) => {
      if (activeShopId == null) return []
      return items.filter((s) => Number(s.shop) === activeShopId)
    },
    [activeShopId],
  )

  useEffect(() => {
    if (!me) resetSales()
  }, [me, resetSales])

  useEffect(() => {
    resetSales()
    setError(null)
  }, [activeShopId, resetSales])

  useEffect(() => {
    setShopOverride(shopImpersonation ?? '')
  }, [shopImpersonation])

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedProductQ(filters.productName.trim()),
      250,
    )
    return () => window.clearTimeout(id)
  }, [filters.productName])

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedCustomerQ(filters.customerName.trim()),
      250,
    )
    return () => window.clearTimeout(id)
  }, [filters.customerName])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    let cancelled = false
    void (async () => {
      try {
        const q = debouncedProductQ.trim()
        const endpoint =
          q.length > 0
            ? `/api/products/?search=${encodeURIComponent(q)}&page_size=8&exclude_discontinued=1`
            : '/api/products/?page_size=8&exclude_discontinued=1'
        const data = await apiJson<Paginated<ProductRow> | ProductRow[]>(
          endpoint,
          SHOP_SCOPED,
        )
        const list = Array.isArray(data) ? data : data.results
        if (!cancelled) setProductHits(list)
      } catch {
        if (!cancelled) setProductHits([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me, canAccessShopData, debouncedProductQ])

  const fetchCustomerSuggestions = useCallback(
    async (q: string) => {
      if (!me || !canAccessShopData) return
      const trimmed = q.trim()
      try {
        const endpoint =
          trimmed.length > 0
            ? `/api/customers/?search=${encodeURIComponent(trimmed)}&page_size=20`
            : '/api/customers/?page_size=20'
        const data = await apiJson<Paginated<CustomerRow> | CustomerRow[]>(
          endpoint,
          SHOP_SCOPED,
        )
        const list = Array.isArray(data) ? data : data.results
        setCustomerHits(list)
      } catch {
        setCustomerHits([])
      }
    },
    [me, canAccessShopData],
  )

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void fetchCustomerSuggestions(debouncedCustomerQ)
  }, [me, canAccessShopData, debouncedCustomerQ, fetchCustomerSuggestions])

  const loadSales = useCallback(
    async (nextFilters?: SalesListFilters) => {
      if (!canAccessShopData) return
      const active = nextFilters ?? filtersRef.current
      setLoading(true)
      setError(null)
      try {
        const url = buildSalesQuery(active)
        const data = await apiJson<SaleRow[] | Paginated<SaleRow>>(url, SHOP_SCOPED)
        const list = Array.isArray(data) ? data : data.results
        setSaleItems(salesForActiveShop(list))
      } catch (e) {
        setError(e instanceof Error ? e.message : t('sales.loadFailed'))
        setSaleItems([])
      } finally {
        setLoading(false)
      }
    },
    [canAccessShopData, salesForActiveShop, setSaleItems, t],
  )

  /** Per-row so Virtuoso always re-renders when `me`/perms change (context alone can stay stale). */
  const salesVirtuosoRows = useMemo(
    () =>
      saleItems.map((sale) => ({
        sale,
        canEditInPos: Boolean(me && hasPerm(me, 'change_sale', 'add_sale')),
      })),
    [saleItems, me],
  )

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void apiJson<ReceiptSettingsRow>('/api/receipt-settings/', SHOP_SCOPED)
      .then((v) => setReceiptSettings(withReceiptPrefs(v)))
      .catch(() => setReceiptSettings(null))
  }, [me, canAccessShopData])

  useEffect(() => {
    if (!me || activeShopId == null) return
    void loadSales(EMPTY_FILTERS)
  }, [me, activeShopId, loadSales])

  useEffect(() => {
    const onShopScopeChange = () => {
      resetSales()
      if (me && activeShopId != null) void loadSales(EMPTY_FILTERS)
    }
    window.addEventListener('mm-dashboard-refresh', onShopScopeChange)
    return () => window.removeEventListener('mm-dashboard-refresh', onShopScopeChange)
  }, [me, activeShopId, loadSales, resetSales])

  function applySalesFilters() {
    const next: SalesListFilters = {
      productName: filters.productName.trim(),
      customerName: filters.customerName.trim(),
      customerId: filters.customerId,
      receiptNumber: filters.receiptNumber.trim(),
      dateFrom: filters.dateFrom.trim(),
      dateTo: filters.dateTo.trim(),
      paymentStatus: filters.paymentStatus,
      discountFilter: filters.discountFilter,
    }
    setFilters(next)
    void loadSales(next)
  }

  function clearSalesFilters() {
    setFilters(EMPTY_FILTERS)
    setDebouncedProductQ('')
    setDebouncedCustomerQ('')
    setProductHits([])
    setCustomerHits([])
    setProductSearchOpen(false)
    setCustomerSearchOpen(false)
    void loadSales(EMPTY_FILTERS)
  }

  function patchFilters(patch: Partial<SalesListFilters>, reload = false) {
    const next = { ...filtersRef.current, ...patch }
    setFilters(next)
    if (reload) void loadSales(next)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  if (authPending) {
    return <PageAuthLoading />
  }

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-start text-xl font-semibold text-slate-900">
          {t('sales.title')} — {t('dash.signIn')}
        </h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="email"
            autoComplete="username"
            placeholder={t('pos.emailPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('pos.passwordPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white"
          >
            {t('dash.signIn')}
          </button>
        </form>
        <Link to="/" className="mt-6 inline-block text-sm text-violet-600">
          {t('nav.home')}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      {needsShop && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-start text-sm text-amber-900">
            <p>{t('inv.superuserShopHint')}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                aria-label={t('pos.shopIdAria')}
                placeholder={t('pos.shopIdPlaceholder')}
                value={shopOverride}
                onChange={(e) => setShopOverride(e.target.value)}
                className="w-28 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900"
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
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-start text-sm text-red-800">
            {error}
          </p>
        )}

        {!needsShop && (
          <form
            className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/40"
            onSubmit={(e) => {
              e.preventDefault()
              applySalesFilters()
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="relative flex min-w-[200px] flex-1 flex-col gap-1 text-start">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('sales.filterProductName')}
                </label>
                <input
                  type="search"
                  value={filters.productName}
                  onChange={(e) => {
                    patchFilters({ productName: e.target.value })
                    setProductSearchOpen(true)
                  }}
                  onFocus={() => setProductSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setProductSearchOpen(false), 120)}
                  placeholder={t('sales.filterProductNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                {productSearchOpen && productHits.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
                    {productHits.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700/80"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const next: SalesListFilters = {
                              ...filters,
                              productName: p.name,
                            }
                            setFilters(next)
                            setProductSearchOpen(false)
                            void loadSales(next)
                          }}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="relative flex min-w-[200px] flex-1 flex-col gap-1 text-start">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('sales.filterCustomerName')}
                </label>
                <input
                  type="search"
                  value={filters.customerName}
                  onChange={(e) => {
                    patchFilters({
                      customerName: e.target.value,
                      customerId: null,
                    })
                    setCustomerSearchOpen(true)
                  }}
                  onFocus={() => {
                    setCustomerSearchOpen(true)
                    void fetchCustomerSuggestions(filters.customerName)
                  }}
                  onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 120)}
                  placeholder={t('sales.filterCustomerNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                {customerSearchOpen && customerHits.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
                    {customerHits.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700/80"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const next: SalesListFilters = {
                              ...filters,
                              customerName: c.name,
                              customerId: c.id,
                            }
                            setFilters(next)
                            setCustomerSearchOpen(false)
                            void loadSales(next)
                          }}
                        >
                          {c.name}
                          {c.phone_1 ? (
                            <span className="text-slate-400"> · {c.phone_1}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex min-w-[160px] flex-1 flex-col gap-1 text-start">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t('sales.filterReceiptNumber')}
                </label>
                <input
                  type="search"
                  inputMode="numeric"
                  value={filters.receiptNumber}
                  onChange={(e) =>
                    patchFilters({
                      receiptNumber: digitsOnlyAscii(e.target.value, 12),
                    })
                  }
                  placeholder={t('sales.filterReceiptNumberPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <label className="flex w-full min-w-[140px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.dateFrom')}
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => patchFilters({ dateFrom: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex w-full min-w-[140px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.dateTo')}
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => patchFilters({ dateTo: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="flex w-full min-w-[160px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.filterPaymentStatus')}
                <select
                  value={filters.paymentStatus}
                  onChange={(e) => {
                    const paymentStatus = e.target.value as PaymentStatusFilter
                    patchFilters({ paymentStatus }, true)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">{t('sales.paymentStatus.all')}</option>
                  <option value="debt">{t('sales.paymentStatus.debt')}</option>
                  <option value="paid">{t('sales.paymentStatus.paid')}</option>
                </select>
              </label>
              <label className="flex w-full min-w-[160px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.filterDiscount')}
                <select
                  value={filters.discountFilter}
                  onChange={(e) => {
                    const discountFilter = e.target.value as DiscountFilter
                    patchFilters({ discountFilter }, true)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">{t('sales.discountFilter.all')}</option>
                  <option value="with_discount">{t('sales.discountFilter.withDiscount')}</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {loading ? t('common.loading') : t('sales.applyFilters')}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={clearSalesFilters}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {t('sales.clearFilters')}
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-slate-500">{t('common.loading')}</p>
        ) : needsShop ? null : saleItems.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">{t('sales.empty')}</p>
        ) : (
          <SalesVirtualList
            t={t}
            receiptSettings={receiptSettings}
            rows={salesVirtuosoRows}
          />
        )}
      </main>
    </div>
  )
}

type SalesVirtuosoRow = { sale: SaleRow; canEditInPos: boolean }

/** Subscribes only to sales items for Virtuoso. */
function SalesVirtualList({
  t,
  receiptSettings,
  rows,
}: {
  t: (k: string) => string
  receiptSettings: ReceiptSettingsRow | null
  rows: SalesVirtuosoRow[]
}) {
  if (rows.length === 0) return null

  return (
    <Virtuoso<SalesVirtuosoRow, { t: (k: string) => string; receiptSettings: ReceiptSettingsRow | null }>
      style={{ height: '65vh' }}
      data={rows}
      context={{ t, receiptSettings }}
      overscan={6}
      computeItemKey={(_, row) => row.sale.id}
      itemContent={(_index, row, ctx) => (
        <div className="pb-4">
          <SaleListRow
            sale={row.sale}
            t={ctx.t}
            receiptSettings={ctx.receiptSettings}
            canEditInPos={row.canEditInPos}
          />
        </div>
      )}
    />
  )
}
