import { TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson } from '../lib/api'
import { formatDecimalTrim, formatMoneyCompact } from '../lib/formatMoney'
import { hasPerm } from '../lib/permissions'
import type { ProfitReportResponse } from '../types/api'

/** Parse API decimal string; handles trailing minus in RTL display. */
function parseReportNumber(s: string): number {
  let t = s.replace(/[\s,،\u066C]/g, '').trim()
  if (t.endsWith('-')) {
    t = `-${t.slice(0, -1)}`
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

function netProfitCellClass(usd: string) {
  const n = parseReportNumber(usd)
  if (n < 0) return 'text-rose-700 dark:text-rose-400'
  if (n > 0) return 'text-emerald-800 dark:text-emerald-400'
  return 'text-slate-700 dark:text-slate-200'
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

  if (!canViewProfit) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <TrendingUp className="h-6 w-6 text-emerald-600" aria-hidden />
          {t('nav.profit')}
        </h1>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          {me.is_superuser && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
              <input
                aria-label={t('pos.shopIdAria')}
                placeholder={t('pos.shopIdPlaceholder')}
                value={shopOverride}
                onChange={(e) => setShopOverride(e.target.value)}
                className="w-14 border-0 bg-transparent"
              />
              <button
                type="button"
                onClick={() => {
                  setShopImpersonation(shopOverride.trim() || null)
                  void fetchReport()
                }}
                className="font-medium text-violet-700"
              >
                {t('pos.apply')}
              </button>
            </div>
          )}
          <div>
            <label htmlFor="pf" className="block text-start text-xs font-medium text-slate-600">
              {t('dash.from')}
            </label>
            <input
              id="pf"
              type="date"
              value={dFrom}
              onChange={(e) => setDFrom(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="pt" className="block text-start text-xs font-medium text-slate-600">
              {t('dash.to')}
            </label>
            <input
              id="pt"
              type="date"
              value={dTo}
              onChange={(e) => setDTo(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchReport()}
            disabled={loading}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? t('common.loading') : t('dash.apply')}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {report && (
          <>
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-start text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t('profit.totalsUsd')}
              </h2>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <dt>{t('profit.saleLinePrices')}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoneyCompact(report.totals.sum_sale_line_prices_usd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <dt>{t('profit.lineBuyCogs')}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoneyCompact(report.totals.sum_sale_line_buy_prices_usd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <dt>{t('profit.customerDiscounts')}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoneyCompact(report.totals.total_customer_discounts_usd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <dt>{t('dash.expenses')}</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoneyCompact(report.totals.total_expenses_usd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <dt>{t('profit.companyDiscountsReceived')}</dt>
                  <dd className="font-mono tabular-nums text-emerald-700">
                    +{formatMoneyCompact(report.totals.total_company_discounts_received_usd)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 sm:col-span-2">
                  <dt className="font-semibold text-slate-900">{t('profit.netProfit')}</dt>
                  <dd className="font-mono text-lg font-semibold tabular-nums text-emerald-800">
                    {formatMoneyCompact(report.totals.net_profit_usd)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch] dark:border-slate-600 dark:bg-slate-900/80">
              <p className="border-b border-slate-100 px-4 py-3 text-start text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
                {t('profit.perProductTableHint')}
              </p>
              <table className="w-full min-w-[720px] text-start text-sm">
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
                  {report.lines.map((row, idx) => (
                    <tr
                      key={
                        report.global_multi_shop
                          ? `${row.shop_id ?? 's'}-${row.product_id}-${idx}`
                          : row.product_id
                      }
                      className={`border-b border-slate-100 dark:border-slate-700/80 ${
                        idx % 2 === 1 ? 'bg-slate-50/70 dark:bg-slate-800/35' : ''
                      }`}
                    >
                      {report.global_multi_shop ? (
                        <td className="px-4 py-3 text-slate-700">
                          {row.shop_name ?? '—'}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.product_name}
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
              {report.lines.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  {t('profit.noSalesInRange')}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
