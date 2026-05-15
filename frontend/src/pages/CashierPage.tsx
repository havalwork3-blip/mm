import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { formatDecimalTrim, formatMoneyCompact } from '../lib/formatMoney'
import { iqdIntegerStringFromUsd } from '../lib/usdIqdDisplay'
import { hasPerm } from '../lib/permissions'
import type {
  CashierLedgerEntry,
  CashierLedgerResponse,
  CashierSummaryResponse,
  Me,
  ProfitReportResponse,
} from '../types/api'

function parseUsdAmount(s: string): number {
  const n = parseFloat(s.replace(/[\s,،\u066C]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Parse API decimal string (RTL trailing minus). */
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
  if (n > 0) return 'text-emerald-700 dark:text-emerald-400'
  return 'text-slate-800 dark:text-slate-200'
}

function formatIqdApprox(usdStr: string, usdToIqd: string): string | null {
  const r = parseFloat(usdToIqd)
  if (!usdToIqd || !(r > 0)) return null
  const iq = Math.round(parseUsdAmount(usdStr) * r)
  return iq.toLocaleString('en-US')
}

function MoneyCard({
  label,
  usd,
  usdToIqd,
  emphasize,
}: {
  label: string
  usd: string
  usdToIqd: string
  emphasize?: boolean
}) {
  const iqd = formatIqdApprox(usd, usdToIqd)
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800 ${
        emphasize ? 'ring-2 ring-emerald-500/25 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-lg tabular-nums ${
          emphasize ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {formatMoneyCompact(usd)}{' '}
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">USD</span>
      </div>
      {iqd != null && (
        <div className="mt-0.5 font-mono text-sm tabular-nums text-slate-600 dark:text-slate-400">
          ≈ {iqd} IQD
        </div>
      )}
    </div>
  )
}

function MoneyDlRow({
  label,
  caption,
  usd,
  usdToIqd,
  strong,
}: {
  label: string
  caption?: string
  usd: string
  usdToIqd: string
  strong?: boolean
}) {
  const iqd = formatIqdApprox(usd, usdToIqd)
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2 dark:border-slate-700">
      <dt className="min-w-0 text-slate-700 dark:text-slate-300">
        <span className="block font-medium">{label}</span>
        {caption ? (
          <span className="mt-1 block text-xs font-normal leading-snug text-slate-500 dark:text-slate-400">
            {caption}
          </span>
        ) : null}
      </dt>
      <dd className="shrink-0 text-end">
        <div
          className={`font-mono tabular-nums text-slate-900 dark:text-slate-100 ${
            strong ? 'text-base font-semibold text-emerald-700 dark:text-emerald-400' : ''
          }`}
        >
          {formatMoneyCompact(usd)} USD
        </div>
        {iqd != null && (
          <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            ≈ {iqd} IQD
          </div>
        )}
      </dd>
    </div>
  )
}

/** One accent per card in «کورتەی ماوە — پارە و قازانج» (eight cards). */
const KPI_ACCENTS = {
  capital:
    'border-l-cyan-500 bg-gradient-to-br from-cyan-50/90 via-white to-white dark:from-cyan-950/25 dark:via-slate-800 dark:to-slate-800/90',
  debts:
    'border-l-slate-600 bg-gradient-to-br from-slate-100/90 via-white to-white dark:from-slate-800/40 dark:via-slate-800 dark:to-slate-800/90',
  flowsOut:
    'border-l-blue-500 bg-gradient-to-br from-blue-50/90 via-white to-white dark:from-blue-950/25 dark:via-slate-800 dark:to-slate-800/90',
  flowsIn:
    'border-l-teal-500 bg-gradient-to-br from-teal-50/90 via-white to-white dark:from-teal-950/25 dark:via-slate-800 dark:to-slate-800/90',
  expense:
    'border-l-amber-500 bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-950/20 dark:via-slate-800 dark:to-slate-800/90',
  payable:
    'border-l-orange-500 bg-gradient-to-br from-orange-50/80 via-white to-white dark:from-orange-950/20 dark:via-slate-800 dark:to-slate-800/90',
  receivable:
    'border-l-rose-500 bg-gradient-to-br from-rose-50/80 via-white to-white dark:from-rose-950/20 dark:via-slate-800 dark:to-slate-800/90',
  net: 'border-l-violet-600 bg-gradient-to-br from-violet-50/90 via-white to-white dark:from-violet-950/30 dark:via-slate-800 dark:to-slate-800/90',
} as const

function PeriodKpiCard({
  label,
  hint,
  usd,
  usdToIqd,
  accent,
  footer,
  signed,
}: {
  label: string
  hint?: string
  usd: string
  usdToIqd: string
  accent: keyof typeof KPI_ACCENTS
  footer?: string
  signed?: boolean
}) {
  const iqd = formatIqdApprox(usd, usdToIqd)
  const n = parseUsdAmount(usd)
  const tone =
    signed && n < 0
      ? 'text-rose-700 dark:text-rose-400'
      : signed && n > 0
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-slate-900 dark:text-slate-100'
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 p-5 shadow-sm dark:border-slate-600/80 ${KPI_ACCENTS[accent]} border-l-4`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {hint ? (
        <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
      <div className={`mt-3 font-mono text-2xl font-semibold tabular-nums tracking-tight ${tone}`}>
        {formatMoneyCompact(usd)}{' '}
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">USD</span>
      </div>
      {iqd != null && (
        <div className="mt-1 font-mono text-sm tabular-nums text-slate-600 dark:text-slate-400">
          ≈ {iqd} IQD
        </div>
      )}
      {footer ? (
        <p className="mt-3 border-t border-slate-200/80 pt-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">
          {footer}
        </p>
      ) : null}
    </div>
  )
}

type VaultRowDef = {
  categoryKey: string
  labelKey: string
  usd: string
  signed?: boolean
}

function VaultOverviewTable({
  summary,
  t,
}: {
  summary: CashierSummaryResponse
  t: (key: string) => string
}) {
  const rate = summary.usd_to_iqd
  const iqdCell = (usd: string) => {
    const v = formatIqdApprox(usd, rate)
    return v != null ? v : '—'
  }

  /** Eight rows, each with its own category label (first column). */
  const rows: VaultRowDef[] = [
    { categoryKey: 'cashier.vaultCat.capital', labelKey: 'cashier.totalCapital', usd: summary.total_capital_usd },
    {
      categoryKey: 'cashier.vaultCat.debtsTotal',
      labelKey: 'cashier.totalDebtsExposure',
      usd: summary.total_debts_exposure_usd,
    },
    {
      categoryKey: 'cashier.vaultCat.supplierPayments',
      labelKey: 'cashier.companyPayments',
      usd: summary.company_payments_usd,
    },
    {
      categoryKey: 'cashier.vaultCat.customerReceipts',
      labelKey: 'cashier.customerReceipts',
      usd: summary.customer_receipts_usd,
    },
    { categoryKey: 'cashier.vaultCat.expenses', labelKey: 'cashier.expenses', usd: summary.expenses_usd },
    {
      categoryKey: 'cashier.vaultCat.supplierDebt',
      labelKey: 'cashier.supplierDebt',
      usd: summary.supplier_debt_usd,
    },
    {
      categoryKey: 'cashier.vaultCat.customerDebt',
      labelKey: 'cashier.customerDebt',
      usd: summary.customer_debt_usd,
    },
    {
      categoryKey: 'cashier.vaultCat.netProfit',
      labelKey: 'cashier.rowNetProfit',
      usd: summary.period_net_profit_usd,
      signed: true,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 border-t-4 border-t-violet-500 bg-white shadow-md dark:border-slate-600 dark:border-t-violet-400 dark:bg-slate-800/80">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-start text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-300">
            <th className="px-3 py-3 text-start font-semibold sm:px-4">{t('cashier.vaultColCategory')}</th>
            <th className="px-3 py-3 text-start font-semibold sm:px-4">{t('cashier.vaultColLabel')}</th>
            <th className="px-3 py-3 text-end font-semibold sm:px-4">{t('cashier.colUsd')}</th>
            <th className="px-3 py-3 text-end font-semibold sm:px-4">{t('cashier.colIqdApprox')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const n = row.signed ? parseUsdAmount(row.usd) : 0
            const numTone =
              row.signed && n < 0
                ? 'text-rose-700 dark:text-rose-400'
                : row.signed && n > 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-slate-50'
            return (
              <tr
                key={row.labelKey}
                className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-700/90 dark:hover:bg-slate-800/60"
              >
                <td className="whitespace-nowrap px-3 py-3 align-middle text-xs font-semibold text-violet-700 dark:text-violet-300 sm:px-4 sm:text-sm">
                  {t(row.categoryKey)}
                </td>
                <td className="max-w-[14rem] px-3 py-3 align-middle text-slate-800 dark:text-slate-100 sm:max-w-[20rem] sm:px-4">
                  <span className="font-medium leading-snug">{t(row.labelKey)}</span>
                </td>
                <td className={`whitespace-nowrap px-3 py-3 text-end font-mono tabular-nums font-medium sm:px-4 ${numTone}`}>
                  {formatMoneyCompact(row.usd)}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-3 text-end font-mono tabular-nums sm:px-4 ${row.signed ? numTone : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {iqdCell(row.usd)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-50/95 text-emerald-950 dark:bg-emerald-950/45 dark:text-emerald-50">
            <td className="px-3 py-3.5 font-semibold leading-snug sm:px-4" colSpan={2}>
              {t('cashier.vaultFooterCash')}
            </td>
            <td className="px-3 py-3.5 text-end font-mono text-base font-bold tabular-nums sm:px-4">
              {formatMoneyCompact(summary.current_cash_usd)}
            </td>
            <td className="px-3 py-3.5 text-end font-mono text-base font-bold tabular-nums sm:px-4">
              {iqdCell(summary.current_cash_usd)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function CashierPage() {
  const { t } = useLocale()
  const [ready, setReady] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [dFrom, setDFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dTo, setDTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [summary, setSummary] = useState<CashierSummaryResponse | null>(null)
  const [ledger, setLedger] = useState<CashierLedgerEntry[]>([])
  const [profitReport, setProfitReport] = useState<ProfitReportResponse | null>(null)
  const [profitReportError, setProfitReportError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [contentOpen, setContentOpen] = useState(false)

  const bootstrap = useCallback(async () => {
    if (!restoreSessionAuth()) {
      setMe(null)
      setReady(true)
      return
    }
    try {
      const profile = await apiJson<Me>('/api/users/me/')
      setMe(profile)
      if (profile.is_superuser) {
        const s = localStorage.getItem('pos_shop_id')
        if (s) setSuperuserShopId(s)
      } else {
        setSuperuserShopId(null)
      }
    } catch (e) {
      if (isApiStatus(e, 401)) {
        setMe(null)
        clearSessionAuth()
        setBasicAuth(null, null)
      } else {
        setError(e instanceof Error ? e.message : t('common.error'))
      }
    } finally {
      setReady(true)
    }
  }, [t])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useResyncLocalMe(bootstrap)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    try {
      setBasicAuth(email, password)
      persistSessionAuth(email, password)
      const profile = await apiJson<Me>('/api/users/me/')
      setMe(profile)
      if (profile.is_superuser) {
        const s = localStorage.getItem('pos_shop_id')
        if (s) setSuperuserShopId(s)
      } else {
        setSuperuserShopId(null)
      }
    } catch (err) {
      setMe(null)
      clearSessionAuth()
      setBasicAuth(null, null)
      setLoginError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  const canUseCashier = Boolean(me && hasPerm(me, 'view_cashier'))
  const canViewProfitTables = Boolean(me && hasPerm(me, 'view_profitreport'))

  const shareholderProfitUsdToIqd = useMemo(() => {
    const fromReport = profitReport?.usd_to_iqd && String(profitReport.usd_to_iqd).trim()
    const fromSummary = summary?.usd_to_iqd && String(summary.usd_to_iqd).trim()
    return fromReport || fromSummary || ''
  }, [profitReport?.usd_to_iqd, summary?.usd_to_iqd])

  const buildQuery = useCallback(() => {
    return new URLSearchParams({
      from: dFrom,
      to: dTo,
    })
  }, [dFrom, dTo])

  const refresh = useCallback(async () => {
    setError(null)
    setProfitReportError(null)
    setLoading(true)
    try {
      const q = buildQuery()
      const [sum, led] = await Promise.all([
        apiJson<CashierSummaryResponse>(`/api/cashier/summary/?${q.toString()}`),
        apiJson<CashierLedgerResponse>(`/api/cashier/ledger/?${q.toString()}`),
      ])
      setSummary(sum)
      setLedger(led.entries)
      if (canViewProfitTables) {
        try {
          const prof = await apiJson<ProfitReportResponse>(`/api/reports/profit/?${q.toString()}`)
          setProfitReport(prof)
        } catch (pe) {
          setProfitReport(null)
          setProfitReportError(pe instanceof Error ? pe.message : t('profit.loadFailed'))
        }
      } else {
        setProfitReport(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [buildQuery, t, canViewProfitTables])

  useEffect(() => {
    if (!canUseCashier) return
    void refresh()
  }, [canUseCashier, refresh])

  const canEditOpening = Boolean(me && hasPerm(me, 'add_openingcash', 'change_openingcash', 'add_shopdayopeningcash', 'change_shopdayopeningcash'))

  function ledgerKindLabel(kind: CashierLedgerEntry['kind']) {
    const key = `cashier.ledgerKind.${kind}` as const
    return t(key)
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

  if (!ready) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
    )
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-start text-slate-900 dark:text-slate-100">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{t('cashier.title')}</h1>
        <form onSubmit={login} className="mt-6 space-y-3">
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

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-6 text-start text-slate-900 dark:text-slate-100">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 px-5 py-8 text-white shadow-2xl ring-1 ring-white/10 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('cashier.title')}</h1>
        </div>
      </div>

      <div className="relative z-10 -mt-6 mx-auto max-w-5xl rounded-2xl border border-slate-200/90 bg-white/95 p-5 shadow-xl backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/95 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between lg:gap-6">
          <div className="flex flex-wrap items-end gap-3 sm:gap-4">
            <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>{t('dash.from')}</span>
              <input
                type="date"
                value={dFrom}
                onChange={(e) => setDFrom(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900 shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex min-w-[10rem] flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>{t('dash.to')}</span>
              <input
                type="date"
                value={dTo}
                onChange={(e) => setDTo(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900 shadow-inner dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void refresh()}
              className="min-h-11 shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500"
            >
              {loading ? t('common.loading') : t('cashier.calculate')}
            </button>
          </div>
          <div
            className={`flex min-h-[3.25rem] min-w-0 flex-1 items-center rounded-xl border px-4 py-3 text-sm leading-snug lg:max-w-md lg:self-stretch lg:justify-end ${
              summary?.usd_to_iqd
                ? 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50'
                : 'border-slate-200/80 bg-slate-50/70 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300'
            }`}
          >
            <span className="w-full lg:text-end">
              {summary
                ? summary.usd_to_iqd
                  ? t('cashier.rateBanner').replace(
                      '{iqd}',
                      Math.round(parseFloat(summary.usd_to_iqd) * 100).toLocaleString('en-US'),
                    )
                  : t('cashier.noExchangeRate')
                : t('cashier.rateBoxBeforeCalc')}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {summary && (
        <>
          <section className="mt-10">
            <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t('cashier.sectionPeriodProfit')}
              </h2>
              {summary.date_from && summary.date_to ? (
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {summary.date_from} → {summary.date_to}
                </p>
              ) : null}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <PeriodKpiCard
                accent="capital"
                label={t('cashier.totalCapital')}
                hint={t('cashier.kpiHintCapital')}
                usd={summary.total_capital_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="debts"
                label={t('cashier.totalDebtsExposure')}
                hint={t('cashier.kpiHintDebtsExposure')}
                usd={summary.total_debts_exposure_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="flowsOut"
                label={t('cashier.companyPayments')}
                hint={t('cashier.kpiHintCompanyPayments')}
                usd={summary.company_payments_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="flowsIn"
                label={t('cashier.customerReceipts')}
                hint={t('cashier.kpiHintCustomerReceipts')}
                usd={summary.customer_receipts_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="expense"
                label={t('cashier.kpiExpensesSummary')}
                hint={t('cashier.kpiExpensesSummaryHint')}
                usd={summary.expenses_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="payable"
                label={t('cashier.supplierDebt')}
                hint={t('cashier.kpiHintSupplierDebt')}
                usd={summary.supplier_debt_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="receivable"
                label={t('cashier.customerDebt')}
                hint={t('cashier.kpiHintCustomerDebt')}
                usd={summary.customer_debt_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <PeriodKpiCard
                accent="net"
                label={t('cashier.rowNetProfit')}
                hint={t('cashier.kpiNetProfitHint')}
                usd={summary.period_net_profit_usd}
                usdToIqd={summary.usd_to_iqd}
                signed
              />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('cashier.sectionCashReconciliation')}
            </h2>
            <dl className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm shadow-md dark:border-slate-700 dark:bg-slate-800">
              <MoneyDlRow
                label={t('cashier.openingCash')}
                usd={summary.opening_cash_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <MoneyDlRow
                label={t('cashier.salesCashIn')}
                usd={summary.sales_cash_in_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <MoneyDlRow
                label={t('cashier.expenses')}
                usd={summary.expenses_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <MoneyDlRow
                label={t('cashier.debtEffect')}
                caption={t('cashier.debtEffectCaption')}
                usd={summary.employee_debt_cash_effect_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <MoneyDlRow
                label={t('cashier.netCash')}
                usd={summary.current_cash_usd}
                usdToIqd={summary.usd_to_iqd}
                strong
              />
            </dl>
          </section>

          <section className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('cashier.accountsSummaryTitle')}</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {t('cashier.accountsTableIntro')}
            </p>
            <div className="mt-5 overflow-x-auto">
              <VaultOverviewTable summary={summary} t={t} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <MoneyCard
                label={t('cashier.purchasesGoods')}
                usd={summary.purchases_goods_usd}
                usdToIqd={summary.usd_to_iqd}
              />
              <MoneyCard
                label={t('cashier.salesInvoiced')}
                usd={summary.sales_invoiced_usd}
                usdToIqd={summary.usd_to_iqd}
              />
            </div>
          </section>
        </>
      )}

      <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-start"
          onClick={() => setContentOpen((o) => !o)}
          aria-expanded={contentOpen}
        >
          <span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">{t('cashier.content')}</span>
            <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">{t('cashier.contentHint')}</span>
          </span>
          <span className="text-slate-500 rtl:rotate-180" aria-hidden>
            {contentOpen ? '▼' : '◀'}
          </span>
        </button>
        {contentOpen && (
          <div className="border-t border-slate-200 px-2 pb-4 dark:border-slate-700">
            {ledger.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-600 dark:text-slate-400">{t('cashier.noLedger')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-start text-xs uppercase text-slate-500 dark:border-slate-600 dark:text-slate-400">
                      <th className="px-2 py-2 font-medium">{t('cashier.ledgerColDate')}</th>
                      <th className="px-2 py-2 font-medium">{t('cashier.ledgerColKind')}</th>
                      <th className="px-2 py-2 font-medium">{t('cashier.ledgerColLabel')}</th>
                      <th className="px-2 py-2 font-medium">{t('cashier.ledgerColAmount')}</th>
                      <th className="px-2 py-2 font-medium">{t('cashier.ledgerColAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => {
                      const target = editTarget(row)
                      const sign =
                        row.direction === 'out' ? '−' : row.direction === 'in' ? '+' : ''
                      const amountClass =
                        row.direction === 'out'
                          ? 'text-rose-700 dark:text-rose-400'
                          : row.direction === 'in'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                      return (
                        <tr
                          key={`${row.kind}-${row.id}-${row.occurred_on}`}
                          className="border-b border-slate-100 dark:border-slate-700/80"
                        >
                          <td className="px-2 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : row.occurred_on}
                          </td>
                          <td className="px-2 py-2">
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs dark:bg-slate-700">
                              {ledgerKindLabel(row.kind)}
                            </span>
                            <span className="ms-2 text-xs text-slate-500">({directionLabel(row.direction)})</span>
                          </td>
                          <td className="max-w-[220px] truncate px-2 py-2 text-slate-700 dark:text-slate-300">
                            {row.label || '—'}
                          </td>
                          <td className={`px-2 py-2 font-mono tabular-nums ${amountClass}`}>
                            {sign}
                            {formatMoneyCompact(row.amount_usd)}
                          </td>
                          <td className="px-2 py-2">
                            {target && (
                              <Link to={target.to} className="text-violet-600 hover:underline">
                                {target.label}
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {canViewProfitTables && (profitReport || profitReportError) && (
        <div className="mt-12 space-y-10">
          <div className="border-b border-slate-200 pb-3 dark:border-slate-700">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('cashier.embeddedProfitTitle')}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('cashier.embeddedProfitIntro')}</p>
            {profitReportError && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                {profitReportError}
              </p>
            )}
          </div>

          {profitReport && !profitReport.global_multi_shop && (
            <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/25 sm:p-6">
              <h3 className="text-start text-sm font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
                {t('profit.dist')}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('profit.distHint')}</p>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">{t('profit.iqdRateFootnote')}</p>
              <div className="mt-4 rounded-xl border border-violet-100 bg-white dark:border-violet-900/30 dark:bg-slate-900">
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/90">
                  {profitReport.profit_distribution.map((row, idx) => {
                    const iqdStr = iqdIntegerStringFromUsd(row.profit_share_usd, shareholderProfitUsdToIqd)
                    const tone = netProfitCellClass(row.profit_share_usd)
                    return (
                      <li
                        key={row.shareholder_id}
                        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5 ${
                          idx % 2 === 1 ? 'bg-slate-50/70 dark:bg-slate-800/40' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            {t('profit.shPct')}:{' '}
                            <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                              {row.share_percentage}%
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0 text-end" dir="ltr">
                          <p className={`font-mono text-lg font-semibold tabular-nums ${tone}`}>
                            {formatMoneyCompact(row.profit_share_usd)}{' '}
                            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">USD</span>
                          </p>
                          {iqdStr != null ? (
                            <p className="mt-1 font-mono text-sm tabular-nums text-slate-600 dark:text-slate-300">
                              ≈ {iqdStr}{' '}
                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {t('customerDebts.amountIqdShort')}
                              </span>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('profit.iqdNoRate')}</p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {profitReport.profit_distribution.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('profit.distEmpty')}
                  </p>
                )}
              </div>
            </section>
          )}

          {profitReport && (
            <section className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch] dark:border-slate-600 dark:bg-slate-900/80">
              <p className="border-b border-slate-100 px-4 py-3 text-start text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:text-slate-400">
                {t('profit.perProductTableHint')}
              </p>
              <table className="w-full min-w-[720px] text-start text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-400">
                  <tr>
                    {profitReport.global_multi_shop ? (
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
                  {profitReport.lines.map((row, idx) => (
                    <tr
                      key={
                        profitReport.global_multi_shop
                          ? `${row.shop_id ?? 's'}-${row.product_id}-${idx}`
                          : row.product_id
                      }
                      className={`border-b border-slate-100 dark:border-slate-700/80 ${
                        idx % 2 === 1 ? 'bg-slate-50/70 dark:bg-slate-800/35' : ''
                      }`}
                    >
                      {profitReport.global_multi_shop ? (
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {row.shop_name ?? '—'}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
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
              {profitReport.lines.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('profit.noSalesInRange')}
                </p>
              )}
            </section>
          )}

          {profitReport && !profitReportError && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              <Link to="/profit" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                {t('cashier.embeddedProfitFullLink')}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
