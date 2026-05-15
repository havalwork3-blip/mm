import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { SaleListRow } from '../components/sales/SaleListRow'
import { useLocale } from '../context/LocaleContext'
import { useResyncLocalMe } from '../hooks/useResyncLocalMe'
import {
  apiJson,
  clearSessionAuth,
  isApiStatus,
  persistSessionAuth,
  restoreSessionAuth,
  setBasicAuth,
  setSuperuserShopId,
} from '../lib/api'
import { hasPerm } from '../lib/permissions'
import { withReceiptPrefs } from '../lib/receiptPrefs'
import { useSalesListStore } from '../stores/salesListStore'
import type {
  CustomerRow,
  Me,
  Paginated,
  ProductRow,
  ReceiptSettingsRow,
  SaleListRow as SaleRow,
} from '../types/api'

export function SalesListPage() {
  const { t } = useLocale()
  type PaymentStatusFilter = 'all' | 'debt' | 'paid'
  const [me, setMe] = useState<Me | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopImpersonation, setShopImpersonation] = useState<string | null>(null)
  const [shopOverride, setShopOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [productSearchInput, setProductSearchInput] = useState('')
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [receiptNumberInput, setReceiptNumberInput] = useState('')
  const [dateFromInput, setDateFromInput] = useState('')
  const [dateToInput, setDateToInput] = useState('')
  const [appliedProductSearch, setAppliedProductSearch] = useState('')
  const [appliedCustomerSearch, setAppliedCustomerSearch] = useState('')
  const [appliedReceiptNumber, setAppliedReceiptNumber] = useState('')
  const [appliedDateFrom, setAppliedDateFrom] = useState('')
  const [appliedDateTo, setAppliedDateTo] = useState('')
  const [paymentStatusInput, setPaymentStatusInput] = useState<PaymentStatusFilter>('all')
  const [appliedPaymentStatus, setAppliedPaymentStatus] = useState<PaymentStatusFilter>('all')
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

  useEffect(() => {
    if (!me) resetSales()
  }, [me, resetSales])

  useEffect(() => {
    setShopOverride(shopImpersonation ?? '')
  }, [shopImpersonation])

  const loadMe = useCallback(async (u: string, p: string) => {
    setBasicAuth(u, p)
    persistSessionAuth(u, p)
    const profile = await apiJson<Me>('/api/users/me/')
    setMe(profile)
    if (profile.is_superuser) {
      const stored = localStorage.getItem('pos_shop_id')
      if (stored) {
        setShopImpersonation(stored)
        setSuperuserShopId(stored)
      } else {
        setShopImpersonation(null)
        setSuperuserShopId(null)
      }
    } else {
      localStorage.removeItem('pos_shop_id')
      setSuperuserShopId(null)
      setShopImpersonation(null)
    }
  }, [])

  const reloadLocalMe = useCallback(async () => {
    if (!restoreSessionAuth()) return
    try {
      const profile = await apiJson<Me>('/api/users/me/')
      setMe(profile)
      if (profile.is_superuser) {
        const stored = localStorage.getItem('pos_shop_id')
        if (stored) {
          setShopImpersonation(stored)
          setSuperuserShopId(stored)
        } else {
          setShopImpersonation(null)
          setSuperuserShopId(null)
        }
      } else {
        localStorage.removeItem('pos_shop_id')
        setSuperuserShopId(null)
        setShopImpersonation(null)
      }
    } catch (e) {
      if (isApiStatus(e, 401)) {
        clearSessionAuth()
        setBasicAuth(null, null)
      }
    }
  }, [])

  useEffect(() => {
    void reloadLocalMe()
  }, [reloadLocalMe])

  useResyncLocalMe(reloadLocalMe)

  const canAccessShopData =
    me &&
    (!me.is_superuser || me.shop !== null || Boolean(shopImpersonation))

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedProductQ(productSearchInput.trim()),
      250,
    )
    return () => window.clearTimeout(id)
  }, [productSearchInput])

  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedCustomerQ(customerSearchInput.trim()),
      250,
    )
    return () => window.clearTimeout(id)
  }, [customerSearchInput])

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

  useEffect(() => {
    if (!me || !canAccessShopData) return
    if (debouncedCustomerQ.length < 1) {
      setCustomerHits([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const data = await apiJson<Paginated<CustomerRow> | CustomerRow[]>(
          `/api/customers/?search=${encodeURIComponent(debouncedCustomerQ)}`,
        )
        const list = Array.isArray(data) ? data : data.results
        if (!cancelled) setCustomerHits(list)
      } catch {
        if (!cancelled) setCustomerHits([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me, canAccessShopData, debouncedCustomerQ])


  const loadSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (appliedProductSearch.trim()) {
        params.set('product_name', appliedProductSearch.trim())
      }
      if (appliedCustomerSearch.trim()) {
        params.set('customer_name', appliedCustomerSearch.trim())
      }
      if (appliedReceiptNumber.trim()) {
        params.set('receipt_number', appliedReceiptNumber.trim())
      }
      if (appliedDateFrom.trim()) params.set('date_from', appliedDateFrom.trim())
      if (appliedDateTo.trim()) params.set('date_to', appliedDateTo.trim())
      if (appliedPaymentStatus !== 'all') params.set('payment_status', appliedPaymentStatus)
      const qs = params.toString()
      const url = qs ? `/api/sales/?${qs}` : '/api/sales/'
      const data = await apiJson<SaleRow[] | Paginated<SaleRow>>(url)
      const list = Array.isArray(data) ? data : data.results
      setSaleItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('sales.loadFailed'))
      setSaleItems([])
    } finally {
      setLoading(false)
    }
  }, [
    appliedProductSearch,
    appliedCustomerSearch,
    appliedReceiptNumber,
    appliedDateFrom,
    appliedDateTo,
    appliedPaymentStatus,
    setSaleItems,
    t,
  ])

  const filteredSales = useMemo(() => {
    if (appliedPaymentStatus === 'all') return saleItems
    return saleItems.filter((sale) => {
      const grossTotal = sale.lines.reduce(
        (sum, line) => sum + line.quantity * Number(line.unit_price_usd),
        0,
      )
      const netTotal = Math.max(0, grossTotal - Number(sale.invoice_discount_usd))
      const rate = Number(sale.exchange_rate_usd_to_iqd)
      const paidInUsd = Number(sale.amount_paid_usd)
      const paidInIqdAsUsd = rate > 0 ? Number(sale.amount_paid_iqd) / rate : 0
      const totalPaid = paidInUsd + paidInIqdAsUsd
      const remaining = netTotal - totalPaid
      const hasDebt = remaining > 0.0001
      return appliedPaymentStatus === 'debt' ? hasDebt : !hasDebt
    })
  }, [appliedPaymentStatus, saleItems])

  /** Per-row so Virtuoso always re-renders when `me`/perms change (context alone can stay stale). */
  const salesVirtuosoRows = useMemo(
    () =>
      filteredSales.map((sale) => ({
        sale,
        canEditInPos: Boolean(me && hasPerm(me, 'change_sale', 'add_sale')),
      })),
    [filteredSales, me],
  )

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void apiJson<ReceiptSettingsRow>('/api/receipt-settings/')
      .then((v) => setReceiptSettings(withReceiptPrefs(v)))
      .catch(() => setReceiptSettings(null))
  }, [me, canAccessShopData])

  useEffect(() => {
    if (!me || !canAccessShopData) return
    void loadSales()
  }, [me, canAccessShopData, loadSales])

  function applySalesFilters() {
    setAppliedProductSearch(productSearchInput.trim())
    setAppliedCustomerSearch(customerSearchInput.trim())
    setAppliedReceiptNumber(receiptNumberInput.trim())
    setAppliedDateFrom(dateFromInput.trim())
    setAppliedDateTo(dateToInput.trim())
    setAppliedPaymentStatus(paymentStatusInput)
  }

  function clearSalesFilters() {
    setProductSearchInput('')
    setCustomerSearchInput('')
    setReceiptNumberInput('')
    setDateFromInput('')
    setDateToInput('')
    setAppliedProductSearch('')
    setAppliedCustomerSearch('')
    setAppliedReceiptNumber('')
    setAppliedDateFrom('')
    setAppliedDateTo('')
    setPaymentStatusInput('all')
    setAppliedPaymentStatus('all')
    setDebouncedProductQ('')
    setDebouncedCustomerQ('')
    setProductHits([])
    setCustomerHits([])
    setProductSearchOpen(false)
    setCustomerSearchOpen(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await loadMe(email, password)
    } catch (err) {
      setMe(null)
      setBasicAuth(null, null)
      clearSessionAuth()
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  const needsShop = me?.is_superuser && me.shop === null && !shopImpersonation

  if (!me) {
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
    <div className="min-h-dvh bg-slate-50">
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
                  if (!v) {
                    localStorage.removeItem('pos_shop_id')
                    setSuperuserShopId(null)
                    setShopImpersonation(null)
                  } else {
                    localStorage.setItem('pos_shop_id', v)
                    setSuperuserShopId(v)
                    setShopImpersonation(v)
                  }
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
            className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
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
                  value={productSearchInput}
                  onChange={(e) => {
                    setProductSearchInput(e.target.value)
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
                          onClick={() => {
                            setProductSearchInput(p.name)
                            setProductSearchOpen(false)
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
                  value={customerSearchInput}
                  onChange={(e) => {
                    setCustomerSearchInput(e.target.value)
                    setCustomerSearchOpen(true)
                  }}
                  onFocus={() => setCustomerSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 120)}
                  placeholder={t('sales.filterCustomerNamePlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                {customerSearchOpen &&
                customerSearchInput.trim().length > 0 &&
                customerHits.length > 0 ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-800">
                    {customerHits.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-700/80"
                          onClick={() => {
                            setCustomerSearchInput(c.name)
                            setCustomerSearchOpen(false)
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
                  value={receiptNumberInput}
                  onChange={(e) => setReceiptNumberInput(e.target.value)}
                  placeholder={t('sales.filterReceiptNumberPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-3 pe-3 text-start text-sm shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <label className="flex w-full min-w-[140px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.dateFrom')}
                <input
                  type="date"
                  value={dateFromInput}
                  onChange={(e) => setDateFromInput(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex w-full min-w-[140px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.dateTo')}
                <input
                  type="date"
                  value={dateToInput}
                  onChange={(e) => setDateToInput(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex w-full min-w-[160px] flex-col gap-1 text-start text-xs font-medium text-slate-600 sm:w-auto">
                {t('sales.filterPaymentStatus')}
                <select
                  value={paymentStatusInput}
                  onChange={(e) => {
                    const next = e.target.value as PaymentStatusFilter
                    setPaymentStatusInput(next)
                    setAppliedPaymentStatus(next)
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="all">{t('sales.paymentStatus.all')}</option>
                  <option value="debt">{t('sales.paymentStatus.debt')}</option>
                  <option value="paid">{t('sales.paymentStatus.paid')}</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
                >
                  {t('sales.applyFilters')}
                </button>
                <button
                  type="button"
                  onClick={clearSalesFilters}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('sales.clearFilters')}
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-center text-sm text-slate-500">{t('common.loading')}</p>
        ) : needsShop ? null : filteredSales.length === 0 ? (
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
