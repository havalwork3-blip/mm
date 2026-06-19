import { Search, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { SaleLossBadge } from '../components/sales/SaleLossBadge'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson } from '../lib/api'
import { resolveDatePresetRange, type DatePreset } from '../lib/datePresets'
import { formatDecimalTrim, formatMoneyCompact } from '../lib/formatMoney'
import { hasPerm } from '../lib/permissions'
import {
  netProfitCellClass,
  parseReportNumber,
  sortProfitLines,
  type ProfitLineSort,
} from '../lib/profitReportFormat'
import { iqdIntegerStringFromUsd } from '../lib/usdIqdDisplay'
import type { ProfitReportResponse } from '../types/api'

function BreakdownRow({
  label,
  value,
  tone = 'neutral',
  prefix,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative' | 'emphasis'
  prefix?: string
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-700 dark:text-rose-400'
        : tone === 'emphasis'
          ? 'text-emerald-900 dark:text-emerald-300'
          : 'text-slate-900 dark:text-slate-100'
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${valueClass}`} dir="ltr">
        {prefix}
        {formatMoneyCompact(value)}
      </span>
    </div>
  )
}

export function ProfitReportPage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, login, shopImpersonation, setShopImpersonation } =
    useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopOverride, setShopOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dFrom, setDFrom] = useState(() =>
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
  )
  const [dTo, setDTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<ProfitReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState<ProfitLineSort>('profit_desc')
  const [lossOnly, setLossOnly] = useState(false)

  const canViewProfit = Boolean(me && hasPerm(me, 'view_profitreport'))

  useEffect(() => {
    setShopOverride(shopImpersonation ?? '')
  }, [shopImpersonation])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = `?from=${encodeURIComponent(dFrom)}&to=${encodeURIComponent(dTo)}`
      const data = await apiJson<ProfitReportResponse>(`/api/reports/profit/${q}`)
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('profit.loadFailed'))
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [dFrom, dTo, t])

  useEffect(() => {
    if (canViewProfit) void fetchReport()
  }, [canViewProfit, fetchReport])

  const applyPreset = useCallback((preset: DatePreset) => {
    const { start, end } = resolveDatePresetRange(preset)
    setDFrom(start)
    setDTo(end)
  }, [])

  const categories = useMemo(() => {
    if (!report) return []
    const map = new Map<number, string>()
    for (const row of report.lines) {
      if (row.category_id != null && row.category_name) {
        map.set(row.category_id, row.category_name)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [report])

  const filteredLines = useMemo(() => {
    if (!report) return []
    const q = search.trim().toLowerCase()
    let rows = report.lines.filter((row) => {
      if (lossOnly && !row.has_loss_sales) return false
      if (categoryId && String(row.category_id ?? '') !== categoryId) return false
      if (!q) return true
      const hay = `${row.product_name} ${row.category_name ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
    rows = sortProfitLines(rows, sort)
    return rows
  }, [report, search, categoryId, sort, lossOnly])

  const filteredTotals = useMemo(() => {
    let sale = 0
    let buy = 0
    let net = 0
    let qty = 0
    for (const row of filteredLines) {
      sale += parseReportNumber(row.total_sale_price_usd)
      buy += parseReportNumber(row.total_buy_price_usd)
      net += parseReportNumber(row.net_profit_usd)
      qty += parseReportNumber(row.quantity_sold)
    }
    return { sale, buy, net, qty, count: filteredLines.length }
  }, [filteredLines])

  if (authPending) {
    return <PageAuthLoading />
  }

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-start text-xl font-semibold">
          {t('nav.profit')} — {t('dash.signIn')}
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
          ← {t('nav.home')}
        </Link>
      </div>
    )
  }

  if (!me || !canViewProfit) {
    return <Navigate to="/" replace />
  }

  const totals = report?.totals
  const inventoryLoss = parseReportNumber(totals?.total_inventory_loss_usd ?? '0')
  const operatingExpenses =
    totals?.total_operating_expenses_usd ??
    String(parseReportNumber(totals?.total_expenses_usd ?? '0') - inventoryLoss)
  const netIqd =
    report?.usd_to_iqd && totals
      ? iqdIntegerStringFromUsd(totals.net_profit_usd, report.usd_to_iqd)
      : null

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <TrendingUp className="h-6 w-6 text-emerald-600" aria-hidden />
          {t('nav.profit')}
        </h1>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {me.is_superuser && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900/50">
                <input
                  aria-label={t('pos.shopIdAria')}
                  placeholder={t('pos.shopIdPlaceholder')}
                  value={shopOverride}
                  onChange={(e) => setShopOverride(e.target.value)}
                  className="w-full min-w-0 border-0 bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShopImpersonation(shopOverride.trim() || null)
                    void fetchReport()
                  }}
                  className="shrink-0 font-medium text-violet-700 dark:text-violet-300"
                >
                  {t('pos.apply')}
                </button>
              </div>
            )}
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('dash.from')}
              </span>
              <input
                type="date"
                value={dFrom}
                onChange={(e) => setDFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t('dash.to')}
              </span>
              <input
                type="date"
                value={dTo}
                onChange={(e) => setDTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void fetchReport()}
                disabled={loading}
                className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              >
                {loading ? t('common.loading') : t('dash.apply')}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['today', 'week', 'month', 'year'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
              >
                {t(
                  preset === 'today'
                    ? 'dash.today'
                    : preset === 'week'
                      ? 'dash.thisWeek'
                      : preset === 'month'
                        ? 'dash.thisMonth'
                        : 'dash.thisYear',
                )}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        )}

        {report && totals && (
          <>
            <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900">
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  {t('profit.netProfit')}
                </p>
                <p
                  className={`mt-1 font-mono text-3xl font-bold tabular-nums ${netProfitCellClass(totals.net_profit_usd)}`}
                  dir="ltr"
                >
                  {formatMoneyCompact(totals.net_profit_usd)}{' '}
                  <span className="text-base font-normal text-slate-500">USD</span>
                </p>
                {netIqd ? (
                  <p className="mt-1 font-mono text-sm tabular-nums text-slate-600 dark:text-slate-400" dir="ltr">
                    ≈ {netIqd} IQD
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">{t('profit.iqdNoRate')}</p>
                )}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {t('profit.periodLabel')}: {report.date_from} — {report.date_to}
                </p>
              </div>
            </section>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t('profit.totalsUsd')}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('profit.summaryFormulaHint')}
                </p>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
                  <BreakdownRow label={t('profit.saleLinePrices')} value={totals.sum_sale_line_prices_usd} />
                  <BreakdownRow
                    label={t('profit.lineBuyCogs')}
                    value={totals.sum_sale_line_buy_prices_usd}
                    prefix="−"
                    tone="negative"
                  />
                  <BreakdownRow
                    label={t('profit.grossMargin')}
                    value={totals.gross_margin_usd ?? String(parseReportNumber(totals.sum_sale_line_prices_usd) - parseReportNumber(totals.sum_sale_line_buy_prices_usd))}
                    tone="emphasis"
                  />
                  <BreakdownRow
                    label={t('profit.customerDiscounts')}
                    value={totals.total_customer_discounts_usd}
                    prefix="−"
                    tone="negative"
                  />
                  <BreakdownRow
                    label={t('profit.operatingExpenses')}
                    value={operatingExpenses}
                    prefix="−"
                    tone="negative"
                  />
                  {inventoryLoss > 0 ? (
                    <BreakdownRow
                      label={t('profit.inventoryLoss')}
                      value={totals.total_inventory_loss_usd ?? '0'}
                      prefix="−"
                      tone="negative"
                    />
                  ) : null}
                  <BreakdownRow
                    label={t('profit.companyDiscountsReceived')}
                    value={totals.total_company_discounts_received_usd}
                    prefix="+"
                    tone="positive"
                  />
                  <div className="pt-2">
                    <BreakdownRow
                      label={t('profit.netProfit')}
                      value={totals.net_profit_usd}
                      tone="emphasis"
                    />
                  </div>
                </div>
              </section>

              {!report.global_multi_shop && report.profit_distribution.length > 0 ? (
                <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm dark:border-violet-900/40 dark:bg-violet-950/20">
                  <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                    {t('profit.dist')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('profit.distHint')}</p>
                  <ul className="mt-4 divide-y divide-violet-100 dark:divide-violet-900/30">
                    {report.profit_distribution.map((row) => (
                      <li key={row.shareholder_id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {t('profit.shPct')}: {row.share_percentage}%
                          </p>
                        </div>
                        <p
                          className={`font-mono text-sm font-semibold tabular-nums ${netProfitCellClass(row.profit_share_usd)}`}
                          dir="ltr"
                        >
                          {formatMoneyCompact(row.profit_share_usd)} USD
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900/80">
              <div className="border-b border-slate-100 p-4 dark:border-slate-700">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[180px] flex-1">
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('profit.filterSearch')}
                    </span>
                    <div className="relative mt-1">
                      <Search
                        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t('profit.filterSearchPlaceholder')}
                        className="w-full rounded-lg border border-slate-200 py-2 ps-9 pe-3 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                    </div>
                  </label>
                  {categories.length > 0 ? (
                    <label className="min-w-[140px]">
                      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                        {t('profit.filterCategory')}
                      </span>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                      >
                        <option value="">{t('profit.filterCategoryAll')}</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="min-w-[140px]">
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('profit.filterSort')}
                    </span>
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as ProfitLineSort)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    >
                      <option value="profit_desc">{t('profit.sortProfitDesc')}</option>
                      <option value="profit_asc">{t('profit.sortProfitAsc')}</option>
                      <option value="name">{t('profit.sortName')}</option>
                      <option value="qty_desc">{t('profit.sortQtyDesc')}</option>
                      <option value="sale_desc">{t('profit.sortSaleDesc')}</option>
                    </select>
                  </label>
                  <label className="flex min-h-[42px] items-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600">
                    <input
                      type="checkbox"
                      checked={lossOnly}
                      onChange={(e) => setLossOnly(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    {t('profit.filterLossOnly')}
                  </label>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {t('profit.productsShown')
                    .replace('{shown}', String(filteredTotals.count))
                    .replace('{total}', String(report.lines.length))}
                  {filteredTotals.count !== report.lines.length ? (
                    <>
                      {' · '}
                      {t('profit.filteredGross')}:{' '}
                      <span className="font-mono tabular-nums" dir="ltr">
                        {formatMoneyCompact(filteredTotals.net)}
                      </span>{' '}
                      USD
                    </>
                  ) : null}
                </p>
              </div>

              <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[760px] text-start text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
                    <tr>
                      {report.global_multi_shop ? (
                        <th className="px-4 py-3 font-medium">{t('profit.thShop')}</th>
                      ) : null}
                      <th className="px-4 py-3 font-medium">{t('profit.thProductName')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thQty')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thUnitBuy')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thTotalBuy')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thUnitSale')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thTotalSale')}</th>
                      <th className="px-4 py-3 font-medium">{t('profit.thLineNet')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.map((row, idx) => (
                      <tr
                        key={
                          report.global_multi_shop
                            ? `${row.shop_id ?? 's'}-${row.product_id}-${idx}`
                            : `${row.product_id}-${row.product_name}-${idx}`
                        }
                        className={`border-b border-slate-100 dark:border-slate-700/80 ${
                          idx % 2 === 1 ? 'bg-slate-50/70 dark:bg-slate-800/35' : ''
                        }`}
                      >
                        {report.global_multi_shop ? (
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                            {row.shop_name ?? '—'}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{row.product_name}</span>
                            {row.category_name ? (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500 dark:bg-slate-800">
                                {row.category_name}
                              </span>
                            ) : null}
                            {row.has_loss_sales ? (
                              <SaleLossBadge
                                soldAtZero={Number(row.quantity_sold_at_zero ?? '0') > 0}
                                soldAtLoss
                                compact
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular-nums" dir="ltr">
                          {formatDecimalTrim(row.quantity_sold, 2)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                          {formatMoneyCompact(row.unit_buy_price_usd)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                          {formatMoneyCompact(row.total_buy_price_usd)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                          {formatMoneyCompact(row.unit_sale_price_usd)}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums" dir="ltr">
                          {formatMoneyCompact(row.total_sale_price_usd)}
                        </td>
                        <td
                          dir="ltr"
                          className={`px-4 py-3 font-mono tabular-nums ${netProfitCellClass(row.net_profit_usd)}`}
                        >
                          {formatMoneyCompact(row.net_profit_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLines.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    {report.lines.length === 0 ? t('profit.noSalesInRange') : t('profit.noFilterMatch')}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
