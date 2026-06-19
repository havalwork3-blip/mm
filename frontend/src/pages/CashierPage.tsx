import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson } from '../lib/api'
import { formatMoneyCompact } from '../lib/formatMoney'
import { hasPerm } from '../lib/permissions'
import type { CashierLedgerEntry, CashierLedgerResponse, CashierSummaryResponse } from '../types/api'

function parseUsdAmount(s: string): number {
  const n = parseFloat(s.replace(/[\s,،\u066C]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatIqdApprox(usdStr: string, usdToIqd: string): string | null {
  const r = parseFloat(usdToIqd)
  if (!usdToIqd || !(r > 0)) return null
  const iq = Math.round(parseUsdAmount(usdStr) * r)
  return iq.toLocaleString('en-US')
}

function CashLine({
  label,
  caption,
  usd,
  usdToIqd,
  emphasize,
  negative,
}: {
  label: string
  caption?: string
  usd: string
  usdToIqd: string
  emphasize?: boolean
  negative?: boolean
}) {
  const iqd = formatIqdApprox(usd, usdToIqd)
  return (
    <div
      className={`flex items-start justify-between gap-4 py-3 ${
        emphasize ? '' : 'border-b border-slate-100 last:border-0 dark:border-slate-700/80'
      }`}
    >
      <div className="min-w-0">
        <p
          className={`text-sm ${emphasize ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
        >
          {label}
        </p>
        {caption ? (
          <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{caption}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-end">
        <p
          className={`font-mono tabular-nums ${
            emphasize
              ? 'text-lg font-bold text-emerald-700 dark:text-emerald-400'
              : negative
                ? 'text-sm text-rose-700 dark:text-rose-400'
                : 'text-sm text-slate-900 dark:text-slate-100'
          }`}
          dir="ltr"
        >
          {negative ? '−' : ''}
          {formatMoneyCompact(usd)} USD
        </p>
        {iqd != null ? (
          <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
            ≈ {iqd} IQD
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function CashierPage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, login } = useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [dFrom, setDFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dTo, setDTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [summary, setSummary] = useState<CashierSummaryResponse | null>(null)
  const [ledger, setLedger] = useState<CashierLedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    try {
      await login(email, password)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  const canUseCashier = Boolean(me && hasPerm(me, 'view_cashier'))
  const canViewProfitReport = Boolean(me && hasPerm(me, 'view_profitreport'))
  const canEditOpening = Boolean(
    me &&
      hasPerm(me, 'add_openingcash', 'change_openingcash', 'add_shopdayopeningcash', 'change_shopdayopeningcash'),
  )

  const buildQuery = useCallback(() => {
    return new URLSearchParams({
      from: dFrom,
      to: dTo,
    })
  }, [dFrom, dTo])

  const refresh = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const q = buildQuery()
      const [sum, led] = await Promise.all([
        apiJson<CashierSummaryResponse>(`/api/cashier/summary/?${q.toString()}`),
        apiJson<CashierLedgerResponse>(`/api/cashier/ledger/?${q.toString()}`),
      ])
      setSummary(sum)
      setLedger(led.entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [buildQuery, t])

  useEffect(() => {
    if (!canUseCashier) return
    void refresh()
  }, [canUseCashier, refresh])

  function ledgerKindLabel(kind: CashierLedgerEntry['kind']) {
    return t(`cashier.ledgerKind.${kind}` as const)
  }

  function directionLabel(d: CashierLedgerEntry['direction']) {
    return t(`cashier.direction.${d}`)
  }

  function editTarget(row: CashierLedgerEntry): { to: string; label: string } | null {
    switch (row.kind) {
      case 'expense':
        return { to: '/manage/expenses', label: t('cashier.ledgerColAction') }
      case 'employee_debt':
        return { to: '/debts', label: t('cashier.ledgerColAction') }
      case 'sale_payment':
        return { to: '/sales', label: t('cashier.ledgerColAction') }
      case 'customer_debt_payment':
        return { to: '/customer-debts', label: t('cashier.ledgerColAction') }
      case 'sale_return':
        return { to: '/sales-returns', label: t('cashier.ledgerColAction') }
      case 'purchase_payment':
        return { to: '/manage/purchases', label: t('cashier.ledgerColAction') }
      case 'opening_cash':
        return canEditOpening ? { to: '/manage/opening-cash', label: t('cashier.editOpening') } : null
      default:
        return null
    }
  }

  if (authPending) {
    return <PageAuthLoading />
  }

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-start text-slate-900 dark:text-slate-100">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t('cashier.title')}</h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t('pos.emailPlaceholder')}
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t('pos.passwordPlaceholder')}
            autoComplete="current-password"
            required
          />
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button type="submit" className="w-full rounded bg-violet-600 py-2 text-white">
            {t('dash.signIn')}
          </button>
        </form>
      </div>
    )
  }

  if (!canUseCashier) {
    return (
      <div className="p-8 text-start text-slate-900 dark:text-slate-100">
        <p className="text-red-600">{t('crud.permissionDenied')}</p>
      </div>
    )
  }

  const currentCashIqd =
    summary?.usd_to_iqd != null ? formatIqdApprox(summary.current_cash_usd, summary.usd_to_iqd) : null

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 text-start text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t('cashier.title')}
          </h1>
          {summary?.date_from && summary?.date_to ? (
            <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
              {summary.date_from} → {summary.date_to}
            </p>
          ) : null}
        </div>
        {canViewProfitReport ? (
          <Link
            to="/profit"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-violet-300 dark:hover:bg-slate-700"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            {t('cashier.embeddedProfitFullLink')}
          </Link>
        ) : null}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>{t('dash.from')}</span>
            <input
              type="date"
              value={dFrom}
              onChange={(e) => setDFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>{t('dash.to')}</span>
            <input
              type="date"
              value={dTo}
              onChange={(e) => setDTo(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="min-h-10 shrink-0 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {loading ? t('common.loading') : t('cashier.calculate')}
          </button>
        </div>
        {summary ? (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              summary.usd_to_iqd
                ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400'
            }`}
          >
            {summary.usd_to_iqd
              ? t('cashier.rateBanner').replace(
                  '{iqd}',
                  Math.round(parseFloat(summary.usd_to_iqd) * 100).toLocaleString('en-US'),
                )
              : t('cashier.noExchangeRate')}
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('cashier.rateBoxBeforeCalc')}</p>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-900">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{t('cashier.netCash')}</p>
            <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-300" dir="ltr">
              {formatMoneyCompact(summary.current_cash_usd)}{' '}
              <span className="text-lg font-semibold text-emerald-700/80 dark:text-emerald-400/80">USD</span>
            </p>
            {currentCashIqd != null ? (
              <p className="mt-1 font-mono text-base tabular-nums text-emerald-700 dark:text-emerald-400/90" dir="ltr">
                ≈ {currentCashIqd} IQD
              </p>
            ) : null}
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('cashier.sectionCashReconciliation')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('cashier.formula')}</p>
            <div className="mt-4">
              <CashLine
                label={t('cashier.openingCash')}
                usd={summary.opening_cash_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <CashLine
                label={t('cashier.salesCashIn')}
                usd={summary.sales_cash_in_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <CashLine
                label={t('cashier.expenses')}
                usd={summary.expenses_usd}
                usdToIqd={summary.usd_to_iqd}
                negative
              />
              <CashLine
                label={t('cashier.debtEffect')}
                caption={t('cashier.debtEffectCaption')}
                usd={summary.employee_debt_cash_effect_usd}
                usdToIqd={summary.usd_to_iqd}
                negative={parseUsdAmount(summary.employee_debt_cash_effect_usd) > 0}
              />
              <div className="mt-2 rounded-xl bg-slate-50 px-3 dark:bg-slate-800/60">
                <CashLine
                  label={t('cashier.netCash')}
                  usd={summary.current_cash_usd}
                  usdToIqd={summary.usd_to_iqd}
                  emphasize
                />
              </div>
            </div>
            {canEditOpening ? (
              <Link
                to="/manage/opening-cash"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
              >
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
                {t('cashier.openingManageLink')}
              </Link>
            ) : null}
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('cashier.ledgerTitle')}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('cashier.contentHint')}</p>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('cashier.noLedger')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-start text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      <th className="px-4 py-2.5">{t('cashier.ledgerColDate')}</th>
                      <th className="px-4 py-2.5">{t('cashier.ledgerColKind')}</th>
                      <th className="px-4 py-2.5">{t('cashier.ledgerColLabel')}</th>
                      <th className="px-4 py-2.5 text-end">{t('cashier.ledgerColAmount')}</th>
                      <th className="px-4 py-2.5 w-0" />
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => {
                      const target = editTarget(row)
                      const sign = row.direction === 'out' ? '−' : row.direction === 'in' ? '+' : ''
                      const amountClass =
                        row.direction === 'out'
                          ? 'text-rose-700 dark:text-rose-400'
                          : row.direction === 'in'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                      return (
                        <tr
                          key={`${row.kind}-${row.id}-${row.occurred_on}`}
                          className="border-b border-slate-50 last:border-0 dark:border-slate-800"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                            {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : row.occurred_on}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {ledgerKindLabel(row.kind)}
                            </span>
                            <span className="ms-1.5 text-xs text-slate-400">({directionLabel(row.direction)})</span>
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-700 dark:text-slate-300">
                            {row.label || '—'}
                          </td>
                          <td className={`px-4 py-2.5 text-end font-mono tabular-nums ${amountClass}`} dir="ltr">
                            {sign}
                            {formatMoneyCompact(row.amount_usd)}
                          </td>
                          <td className="px-4 py-2.5">
                            {target ? (
                              <Link to={target.to} className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400">
                                {target.label}
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
