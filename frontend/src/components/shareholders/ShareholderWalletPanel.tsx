import { ArrowDownCircle, ArrowUpCircle, History, RefreshCw, Wallet, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { useSession } from '../../context/SessionContext'
import { apiJson } from '../../lib/api'
import { formatMoneyCompact } from '../../lib/formatMoney'

type WalletRow = {
  shareholder_id: number
  name: string
  share_percentage: string
  capital_contribution_usd: string
  wallet_start_month: string
  total_earned_usd: string
  total_paid_usd: string
  balance_usd: string
  current_month_estimate_usd: string
}

type WalletsResponse = {
  shop_net_profit_this_month_usd: string
  wallets: WalletRow[]
}

type HistoryEntry = {
  kind: 'profit_share' | 'payout'
  id: number
  date: string
  month: string | null
  amount_usd: string
  balance_after_usd: string
  shop_net_profit_usd?: string
  share_percentage?: string
  note: string
}

type WalletDetail = WalletRow & { history: HistoryEntry[] }

function num(value: string | undefined | null): number {
  const n = Number(String(value ?? '0').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function monthLabel(iso: string, lang: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const locale = lang === 'ar' ? 'ar-IQ' : lang === 'ku' ? 'ckb-IQ' : 'en-GB'
  try {
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long' })
  } catch {
    return iso.slice(0, 7)
  }
}

function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function previousMonthIso(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function signedClass(value: string): string {
  const n = num(value)
  if (n > 0.004) return 'text-emerald-700 dark:text-emerald-300'
  if (n < -0.004) return 'text-rose-700 dark:text-rose-300'
  return 'text-slate-700 dark:text-slate-200'
}

/**
 * Partner wallets: each finished month credits the partner's share of net profit;
 * payouts are taken from the wallet and can never exceed its balance.
 */
export function ShareholderWalletPanel({ refreshKey }: { refreshKey: string }) {
  const { t, lang } = useLocale()
  const { me } = useSession()
  const canRecalculate = Boolean(me?.is_superuser || me?.role === 'owner')

  const [data, setData] = useState<WalletsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [payFor, setPayFor] = useState<WalletRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayIso())
  const [payNote, setPayNote] = useState('')
  const [payError, setPayError] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)

  const [detail, setDetail] = useState<WalletDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [recalcMonth, setRecalcMonth] = useState(previousMonthIso())
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null)
  const [recalcBusy, setRecalcBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await apiJson<WalletsResponse>('/api/shareholders/wallets/', { shopScoped: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function openHistory(row: WalletRow) {
    setDetailLoading(true)
    setDetail({ ...row, history: [] })
    try {
      setDetail(
        await apiJson<WalletDetail>(`/api/shareholders/${row.shareholder_id}/wallet/`, { shopScoped: true }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  function openPay(row: WalletRow) {
    setPayFor(row)
    // Round DOWN to cents: the balance has 4 decimals and the server rejects anything above it.
    const bal = num(row.balance_usd)
    setPayAmount(bal > 0 ? (Math.floor(bal * 100 + 1e-6) / 100).toFixed(2) : '')
    setPayDate(todayIso())
    setPayNote('')
    setPayError(null)
  }

  async function submitPay() {
    if (!payFor) return
    const amount = num(payAmount)
    if (amount <= 0) {
      setPayError(t('wallet.enterAmount'))
      return
    }
    if (Number(amount.toFixed(2)) > num(payFor.balance_usd) + 1e-9) {
      setPayError(t('wallet.overBalance').replace('{usd}', formatMoneyCompact(payFor.balance_usd)))
      return
    }
    setPaying(true)
    setPayError(null)
    try {
      await apiJson('/api/shareholder-payments/', {
        method: 'POST',
        shopScoped: true,
        body: JSON.stringify({
          shareholder: payFor.shareholder_id,
          amount_usd: amount.toFixed(2),
          paid_on: payDate,
          note: payNote.trim(),
        }),
      })
      setPayFor(null)
      await load()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPaying(false)
    }
  }

  async function recalculate() {
    if (recalcBusy) return
    setRecalcBusy(true)
    setRecalcMsg(null)
    try {
      const res = await apiJson<{ updated: number }>('/api/shareholders/recalculate-month/', {
        method: 'POST',
        shopScoped: true,
        body: JSON.stringify({ month: recalcMonth }),
      })
      setRecalcMsg(t('wallet.recalcDone').replace('{n}', String(res.updated)))
      await load()
    } catch (e) {
      setRecalcMsg(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setRecalcBusy(false)
    }
  }

  const wallets = data?.wallets ?? []

  return (
    <section className="mb-6 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/70 to-white p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-violet-900 dark:text-violet-200">
            <Wallet className="h-5 w-5 shrink-0" aria-hidden />
            {t('wallet.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-600 dark:text-slate-400">{t('wallet.hint')}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          {t('wallet.refresh')}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {!loading && wallets.length === 0 && !error ? (
        <p className="mt-4 text-sm text-slate-500">{t('wallet.empty')}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wallets.map((w) => (
          <article
            key={w.shareholder_id}
            className="flex flex-col rounded-xl border border-violet-100 bg-white p-4 dark:border-violet-900/30 dark:bg-slate-900/70"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{w.name}</p>
                <p className="text-xs text-slate-500">
                  {t('profit.shPct')}: {w.share_percentage}% · {t('wallet.since')}{' '}
                  {monthLabel(w.wallet_start_month, lang)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs font-medium text-slate-500">{t('wallet.balance')}</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${signedClass(w.balance_usd)}`} dir="ltr">
              {formatMoneyCompact(w.balance_usd)} USD
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">{t('wallet.earned')}</dt>
              <dd className={`text-end font-mono tabular-nums ${signedClass(w.total_earned_usd)}`} dir="ltr">
                {formatMoneyCompact(w.total_earned_usd)}
              </dd>
              <dt className="text-slate-500">{t('wallet.paid')}</dt>
              <dd className="text-end font-mono tabular-nums text-slate-700 dark:text-slate-200" dir="ltr">
                {formatMoneyCompact(w.total_paid_usd)}
              </dd>
              <dt className="text-slate-500">{t('wallet.thisMonth')}</dt>
              <dd className={`text-end font-mono tabular-nums ${signedClass(w.current_month_estimate_usd)}`} dir="ltr">
                {formatMoneyCompact(w.current_month_estimate_usd)}
              </dd>
              <dt className="text-slate-500">{t('settings.shareholderCapitalUsd')}</dt>
              <dd className="text-end font-mono tabular-nums text-slate-700 dark:text-slate-200" dir="ltr">
                {formatMoneyCompact(w.capital_contribution_usd)}
              </dd>
            </dl>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => openPay(w)}
                disabled={num(w.balance_usd) <= 0.004}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUpCircle className="h-4 w-4" aria-hidden />
                {t('wallet.pay')}
              </button>
              <button
                type="button"
                onClick={() => void openHistory(w)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <History className="h-4 w-4" aria-hidden />
                {t('wallet.history')}
              </button>
            </div>
          </article>
        ))}
      </div>

      {canRecalculate && wallets.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-violet-100 pt-3 text-xs dark:border-violet-900/30">
          <label className="flex flex-col gap-1">
            <span className="text-slate-600 dark:text-slate-400">{t('wallet.recalcLabel')}</span>
            <input
              type="month"
              value={recalcMonth}
              max={previousMonthIso()}
              onChange={(e) => setRecalcMonth(e.target.value)}
              className="min-h-9 rounded-lg border border-slate-200 px-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            onClick={() => void recalculate()}
            disabled={recalcBusy}
            className="min-h-9 disabled:opacity-50 rounded-lg border border-violet-300 px-3 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40"
          >
            {t('wallet.recalc')}
          </button>
          <span className="text-slate-500">{recalcMsg ?? t('wallet.recalcHint')}</span>
        </div>
      ) : null}

      {payFor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {t('wallet.payTitle').replace('{name}', payFor.name)}
              </h3>
              <button type="button" onClick={() => setPayFor(null)} aria-label={t('common.close')}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('wallet.available')}:{' '}
              <span className="font-mono font-semibold" dir="ltr">
                {formatMoneyCompact(payFor.balance_usd)} USD
              </span>
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('wallet.amountUsd')}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  dir="ltr"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('wallet.date')}</span>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">{t('wallet.note')}</span>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-3 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <p className="text-xs text-slate-500">{t('wallet.payCashHint')}</p>
            </div>
            {payError ? <p className="mt-3 text-sm text-rose-600">{payError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayFor(null)}
                className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm dark:border-slate-600 dark:text-slate-200"
              >
                {t('crud.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void submitPay()}
                disabled={paying}
                className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {paying ? t('common.loading') : t('wallet.confirmPay')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 p-4 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                  {t('wallet.historyTitle').replace('{name}', detail.name)}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('wallet.balance')}:{' '}
                  <span className={`font-mono font-semibold ${signedClass(detail.balance_usd)}`} dir="ltr">
                    {formatMoneyCompact(detail.balance_usd)} USD
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label={t('common.close')}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-500">{t('common.loading')}</p>
              ) : detail.history.length === 0 ? (
                <p className="text-sm text-slate-500">{t('wallet.noHistory')}</p>
              ) : (
                <ul className="space-y-2">
                  {detail.history.map((h) => (
                    <li
                      key={`${h.kind}-${h.id}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 dark:border-slate-800"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {h.kind === 'payout' ? (
                          <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                        ) : (
                          <ArrowDownCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {h.kind === 'payout'
                              ? t('wallet.entryPayout')
                              : t('wallet.entryShare').replace('{month}', monthLabel(h.month ?? h.date, lang))}
                          </p>
                          <p className="text-xs text-slate-500">
                            {h.kind === 'payout'
                              ? `${h.date}${h.note ? ` · ${h.note}` : ''}`
                              : t('wallet.entryShareDetail')
                                  .replace('{net}', formatMoneyCompact(h.shop_net_profit_usd ?? '0'))
                                  .replace('{pct}', h.share_percentage ?? '')}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-end">
                        <p className={`font-mono text-sm font-semibold tabular-nums ${signedClass(h.amount_usd)}`} dir="ltr">
                          {num(h.amount_usd) > 0 ? '+' : ''}
                          {formatMoneyCompact(h.amount_usd)}
                        </p>
                        <p className="font-mono text-[11px] tabular-nums text-slate-400" dir="ltr">
                          = {formatMoneyCompact(h.balance_after_usd)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
