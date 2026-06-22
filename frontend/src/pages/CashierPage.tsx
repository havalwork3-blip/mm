import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarRange,
  ExternalLink,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Vault,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson } from '../lib/api'
import { formatMoneyCompact } from '../lib/formatMoney'
import { hasPerm } from '../lib/permissions'
import type { CashierLedgerEntry, CashierLedgerResponse, CashierSummaryResponse } from '../types/api'

const FLOW_COLORS = {
  opening: '#6366f1',
  sales: '#10b981',
  customerDebt: '#22c55e',
  expenses: '#f43f5e',
  debt: '#f59e0b',
  purchase: '#0ea5e9',
  saleReturn: '#ec4899',
  net: '#8b5cf6',
} as const

function cashierBreakdown(summary: CashierSummaryResponse) {
  return {
    posSales: summary.pos_sale_payments_usd ?? summary.sales_cash_in_usd,
    customerDebtReceipts: summary.customer_debt_receipts_usd ?? '0',
    saleReturns: summary.sale_returns_usd ?? '0',
    purchasePayments: summary.company_payments_usd ?? '0',
  }
}

function parseUsdAmount(s: string): number {
  const n = parseFloat(s.replace(/[\s,،\u066C]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function resolvePresetRange(preset: 'today' | 'week' | 'month' | 'year') {
  const now = new Date()
  const end = formatDateInput(now)
  let startDate = new Date(now)
  if (preset === 'week') {
    const day = now.getDay()
    const diffToMonday = (day + 6) % 7
    startDate.setDate(now.getDate() - diffToMonday)
  } else if (preset === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (preset === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1)
  } else {
    startDate = now
  }
  return { start: formatDateInput(startDate), end }
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso.slice(5)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatIqdApprox(usdStr: string, usdToIqd: string): string | null {
  const r = parseFloat(usdToIqd)
  if (!usdToIqd || !(r > 0)) return null
  const iq = Math.round(parseUsdAmount(usdStr) * r)
  return iq.toLocaleString('en-US')
}

function formatUsdShort(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(abs >= 100 ? 0 : 2).replace(/\.?0+$/, '')
}

type ReconciliationRow = {
  key: string
  label: string
  caption?: string
  usd: string
  color: string
  negative?: boolean
}

function ReconciliationBar({
  row,
  maxValue,
  usdToIqd,
}: {
  row: ReconciliationRow
  maxValue: number
  usdToIqd: string
}) {
  const amount = parseUsdAmount(row.usd)
  const widthPct = maxValue > 0 ? Math.min(100, (Math.abs(amount) / maxValue) * 100) : 0
  const iqd = formatIqdApprox(row.usd, usdToIqd)

  return (
    <div className="group rounded-xl border border-slate-100/80 bg-slate-50/60 p-3 transition hover:border-slate-200 hover:bg-white dark:border-slate-700/60 dark:bg-slate-800/40 dark:hover:border-slate-600 dark:hover:bg-slate-800/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{row.label}</p>
          </div>
          {row.caption ? (
            <p className="mt-0.5 ps-4 text-xs leading-snug text-slate-500 dark:text-slate-400">{row.caption}</p>
          ) : null}
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${widthPct}%`, backgroundColor: row.color }}
            />
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p
            className={`font-mono text-sm font-semibold tabular-nums ${
              row.negative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
            }`}
            dir="ltr"
          >
            {row.negative ? '−' : ''}
            {formatMoneyCompact(row.usd)} USD
          </p>
          {iqd != null ? (
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
              ≈ {iqd} IQD
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompactMetricCard({
  shortLabel,
  fullLabel,
  usd,
  usdToIqd,
  icon: Icon,
  accent,
  muted,
}: {
  shortLabel: string
  fullLabel: string
  usd: string
  usdToIqd: string
  icon: typeof Wallet
  accent: string
  muted?: boolean
}) {
  const iqd = formatIqdApprox(usd, usdToIqd)
  const amount = parseUsdAmount(usd)

  return (
    <div
      className={`rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/80 ${
        muted ? 'opacity-50' : ''
      }`}
      title={fullLabel}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{shortLabel}</p>
          <p
            className={`mt-0.5 font-mono text-lg font-bold tabular-nums leading-none ${
              amount > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'
            }`}
            dir="ltr"
          >
            {formatMoneyCompact(usd)}
            <span className="ms-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">USD</span>
          </p>
          {iqd != null && amount > 0 ? (
            <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
              ≈ {iqd} IQD
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CashierMetricsPanel({
  summary,
  breakdown,
  t,
}: {
  summary: CashierSummaryResponse
  breakdown: ReturnType<typeof cashierBreakdown>
  t: (key: string) => string
}) {
  const currentCashIqd = formatIqdApprox(summary.current_cash_usd, summary.usd_to_iqd)
  const debtAmt = parseUsdAmount(summary.employee_debt_cash_effect_usd)

  const inflowMetrics: {
    id: string
    shortLabel: string
    fullLabel: string
    usd: string
    icon: typeof Wallet
    accent: string
  }[] = [
    {
      id: 'opening',
      shortLabel: t('cashier.chartLabel.opening'),
      fullLabel: t('cashier.openingCash'),
      usd: summary.opening_cash_usd,
      icon: Wallet,
      accent: FLOW_COLORS.opening,
    },
    {
      id: 'sales',
      shortLabel: t('cashier.chartLabel.sales'),
      fullLabel: t('cashier.posSalesPaid'),
      usd: breakdown.posSales,
      icon: TrendingUp,
      accent: FLOW_COLORS.sales,
    },
    {
      id: 'customer-debt',
      shortLabel: t('cashier.chartLabel.customerDebt'),
      fullLabel: t('cashier.customerDebtReceipts'),
      usd: breakdown.customerDebtReceipts,
      icon: Users,
      accent: FLOW_COLORS.customerDebt,
    },
  ]

  const outflowMetrics: {
    id: string
    shortLabel: string
    fullLabel: string
    usd: string
    icon: typeof Wallet
    accent: string
  }[] = [
    {
      id: 'returns',
      shortLabel: t('cashier.chartLabel.returns'),
      fullLabel: t('cashier.saleReturnsCash'),
      usd: breakdown.saleReturns,
      icon: RotateCcw,
      accent: FLOW_COLORS.saleReturn,
    },
    {
      id: 'expenses',
      shortLabel: t('cashier.chartLabel.expenses'),
      fullLabel: t('cashier.expenses'),
      usd: summary.expenses_usd,
      icon: TrendingDown,
      accent: FLOW_COLORS.expenses,
    },
    {
      id: 'purchases',
      shortLabel: t('cashier.chartLabel.purchases'),
      fullLabel: t('cashier.companyPayments'),
      usd: breakdown.purchasePayments,
      icon: ShoppingCart,
      accent: FLOW_COLORS.purchase,
    },
    {
      id: 'staff-debt',
      shortLabel: t('cashier.chartLabel.staffDebt'),
      fullLabel: t('cashier.debtEffect'),
      usd: debtAmt > 0 ? summary.employee_debt_cash_effect_usd : '0',
      icon: Minus,
      accent: FLOW_COLORS.debt,
    },
  ]

  if (debtAmt < -0.0001) {
    inflowMetrics.push({
      id: 'staff-return',
      shortLabel: t('cashier.chartLabel.staffDebt'),
      fullLabel: t('cashier.debtEffect'),
      usd: String(Math.abs(debtAmt)),
      icon: Plus,
      accent: FLOW_COLORS.debt,
    })
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/50 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div className="border-b border-emerald-200/70 bg-gradient-to-br from-emerald-500/10 via-white to-violet-500/5 p-4 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-violet-950/20 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              {t('cashier.netCash')}
            </p>
            <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-900 dark:text-emerald-200 sm:text-4xl" dir="ltr">
              {formatMoneyCompact(summary.current_cash_usd)}
              <span className="ms-2 text-lg font-semibold text-emerald-700/80 dark:text-emerald-400/80">USD</span>
            </p>
            {currentCashIqd != null ? (
              <p className="mt-1 font-mono text-sm tabular-nums text-emerald-700/90 dark:text-emerald-400/90" dir="ltr">
                ≈ {currentCashIqd} IQD
              </p>
            ) : null}
          </div>
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Vault className="h-7 w-7" aria-hidden />
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <ArrowDownLeft className="h-4 w-4" aria-hidden />
            {t('cashier.sectionInflows')}
          </h3>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {inflowMetrics.map((m) => (
              <CompactMetricCard
                key={m.id}
                shortLabel={m.shortLabel}
                fullLabel={m.fullLabel}
                usd={m.usd}
                usdToIqd={summary.usd_to_iqd}
                icon={m.icon}
                accent={m.accent}
                muted={parseUsdAmount(m.usd) <= 0.0001 && m.id !== 'opening'}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
            <ArrowUpRight className="h-4 w-4" aria-hidden />
            {t('cashier.sectionOutflows')}
          </h3>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {outflowMetrics.map((m) => (
              <CompactMetricCard
                key={m.id}
                shortLabel={m.shortLabel}
                fullLabel={m.fullLabel}
                usd={m.usd}
                usdToIqd={summary.usd_to_iqd}
                icon={m.icon}
                accent={m.accent}
                muted={parseUsdAmount(m.usd) <= 0.0001}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  isDark,
}: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; payload?: FlowBarRow }[]
  label?: string
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const flowRow = payload[0]?.payload
  if (flowRow?.fullLabel) {
    return (
      <div
        className={`rounded-xl border px-3 py-2.5 text-xs shadow-xl ${
          isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="mb-1 max-w-[14rem] font-semibold leading-snug">{flowRow.fullLabel}</p>
        <p className="font-mono text-sm font-bold tabular-nums" style={{ color: flowRow.fill }}>
          {formatMoneyCompact(String(flowRow.value))} USD
        </p>
      </div>
    )
  }
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs shadow-xl ${
        isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      {label ? <p className="mb-1 font-semibold">{label}</p> : null}
      {payload.map((p) => (
        <p key={String(p.name)} className="font-mono tabular-nums" style={{ color: p.color }}>
          {p.name}: {formatUsdShort(Number(p.value ?? 0))} USD
        </p>
      ))}
    </div>
  )
}

type FlowBarRow = {
  id: string
  shortLabel: string
  fullLabel: string
  value: number
  fill: string
}

function CashFlowBreakdownChart({
  data,
  isDark,
  isRtl,
  axisTick,
  gridStroke,
}: {
  data: FlowBarRow[]
  isDark: boolean
  isRtl: boolean
  axisTick: string
  gridStroke: string
}) {
  const height = Math.max(280, data.length * 48 + 28)
  const labelSide = isRtl ? 'left' : 'right'

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: isRtl ? 12 : 52, left: isRtl ? 52 : 12, bottom: 4 }}
          barCategoryGap="18%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: axisTick, fontSize: 11 }}
            tickFormatter={formatUsdShort}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="shortLabel"
            width={76}
            orientation={isRtl ? 'right' : 'left'}
            tick={{ fill: axisTick, fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<ChartTooltip isDark={isDark} />}
            cursor={{ fill: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.12)' }}
          />
          <Bar dataKey="value" radius={isRtl ? [8, 0, 0, 8] : [0, 8, 8, 0]} barSize={22} maxBarSize={26}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="value"
              position={labelSide}
              formatter={(v) => `${formatUsdShort(Number(v ?? 0))} $`}
              className="font-mono text-[11px] font-semibold tabular-nums"
              fill={axisTick}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function OutstandingCard({
  label,
  value,
  usdToIqd,
  hint,
  tone,
}: {
  label: string
  value: string
  usdToIqd: string
  hint?: string
  tone: 'emerald' | 'sky' | 'amber' | 'violet'
}) {
  const iqd = formatIqdApprox(value, usdToIqd)
  const tones = {
    emerald: 'border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
    sky: 'border-sky-200/70 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20',
    amber: 'border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20',
    violet: 'border-violet-200/70 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20',
  }
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
        {formatMoneyCompact(value)} USD
      </p>
      {iqd != null ? (
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
          ≈ {iqd} IQD
        </p>
      ) : null}
      {hint ? <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function CashierPage() {
  const { t, isRtl } = useLocale()
  const { resolvedMode } = useTheme()
  const isDark = resolvedMode === 'dark'
  const { me, authPending, showLogin, login } = useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [dFrom, setDFrom] = useState(() => formatDateInput(new Date()))
  const [dTo, setDTo] = useState(() => formatDateInput(new Date()))
  const [summary, setSummary] = useState<CashierSummaryResponse | null>(null)
  const [ledger, setLedger] = useState<CashierLedgerEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const gridStroke = isDark ? '#334155' : '#e2e8f0'
  const axisTick = isDark ? '#94a3b8' : '#64748b'

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
    return new URLSearchParams({ from: dFrom, to: dTo })
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

  function applyDatePreset(preset: 'today' | 'week' | 'month' | 'year') {
    const { start, end } = resolvePresetRange(preset)
    setDFrom(start)
    setDTo(end)
  }

  const activePreset = useMemo((): 'today' | 'week' | 'month' | 'year' | null => {
    for (const preset of ['today', 'week', 'month', 'year'] as const) {
      const { start, end } = resolvePresetRange(preset)
      if (dFrom === start && dTo === end) return preset
    }
    return null
  }, [dFrom, dTo])

  const breakdown = useMemo(() => (summary ? cashierBreakdown(summary) : null), [summary])

  const inflowRows = useMemo((): ReconciliationRow[] => {
    if (!summary || !breakdown) return []
    const debtAmt = parseUsdAmount(summary.employee_debt_cash_effect_usd)
    const rows: ReconciliationRow[] = [
      {
        key: 'opening',
        label: t('cashier.openingCash'),
        usd: summary.opening_cash_usd,
        color: FLOW_COLORS.opening,
      },
      {
        key: 'pos-sales',
        label: t('cashier.posSalesPaid'),
        usd: breakdown.posSales,
        color: FLOW_COLORS.sales,
      },
    ]
    if (parseUsdAmount(breakdown.customerDebtReceipts) > 0.0001) {
      rows.push({
        key: 'customer-debt',
        label: t('cashier.customerDebtReceipts'),
        usd: breakdown.customerDebtReceipts,
        color: FLOW_COLORS.customerDebt,
      })
    }
    if (debtAmt < -0.0001) {
      rows.push({
        key: 'debt-return',
        label: t('cashier.debtEffect'),
        caption: t('cashier.debtEffectCaption'),
        usd: String(Math.abs(debtAmt)),
        color: FLOW_COLORS.debt,
      })
    }
    return rows
  }, [breakdown, summary, t])

  const outflowRows = useMemo((): ReconciliationRow[] => {
    if (!summary || !breakdown) return []
    const debtAmt = parseUsdAmount(summary.employee_debt_cash_effect_usd)
    const rows: ReconciliationRow[] = []
    if (parseUsdAmount(breakdown.saleReturns) > 0.0001) {
      rows.push({
        key: 'sale-returns',
        label: t('cashier.saleReturnsCash'),
        usd: breakdown.saleReturns,
        color: FLOW_COLORS.saleReturn,
        negative: true,
      })
    }
    if (parseUsdAmount(summary.expenses_usd) > 0.0001) {
      rows.push({
        key: 'expenses',
        label: t('cashier.expenses'),
        usd: summary.expenses_usd,
        color: FLOW_COLORS.expenses,
        negative: true,
      })
    }
    if (parseUsdAmount(breakdown.purchasePayments) > 0.0001) {
      rows.push({
        key: 'purchases',
        label: t('cashier.companyPayments'),
        caption: t('cashier.purchasesGoodsHint'),
        usd: breakdown.purchasePayments,
        color: FLOW_COLORS.purchase,
        negative: true,
      })
    }
    if (debtAmt > 0.0001) {
      rows.push({
        key: 'debt-taken',
        label: t('cashier.debtEffect'),
        caption: t('cashier.debtEffectCaption'),
        usd: summary.employee_debt_cash_effect_usd,
        color: FLOW_COLORS.debt,
        negative: true,
      })
    }
    return rows
  }, [breakdown, summary, t])

  const maxReconciliation = useMemo(() => {
    if (!summary) return 0
    const amounts = [
      summary.opening_cash_usd,
      summary.expenses_usd,
      summary.current_cash_usd,
      summary.employee_debt_cash_effect_usd,
      summary.company_payments_usd,
      summary.sale_returns_usd,
      summary.pos_sale_payments_usd,
      summary.customer_debt_receipts_usd,
      summary.sales_cash_in_usd,
    ]
    return Math.max(...amounts.map((s) => parseUsdAmount(s ?? '0')), 1)
  }, [summary])

  const barChartData = useMemo((): FlowBarRow[] => {
    if (!summary || !breakdown) return []
    return [
      {
        id: 'opening',
        shortLabel: t('cashier.chartLabel.opening'),
        fullLabel: t('cashier.openingCash'),
        value: parseUsdAmount(summary.opening_cash_usd),
        fill: FLOW_COLORS.opening,
      },
      {
        id: 'sales',
        shortLabel: t('cashier.chartLabel.sales'),
        fullLabel: t('cashier.posSalesPaid'),
        value: parseUsdAmount(breakdown.posSales),
        fill: FLOW_COLORS.sales,
      },
      {
        id: 'customer-debt',
        shortLabel: t('cashier.chartLabel.customerDebt'),
        fullLabel: t('cashier.customerDebtReceipts'),
        value: parseUsdAmount(breakdown.customerDebtReceipts),
        fill: FLOW_COLORS.customerDebt,
      },
      {
        id: 'expenses',
        shortLabel: t('cashier.chartLabel.expenses'),
        fullLabel: t('cashier.expenses'),
        value: parseUsdAmount(summary.expenses_usd),
        fill: FLOW_COLORS.expenses,
      },
      {
        id: 'purchases',
        shortLabel: t('cashier.chartLabel.purchases'),
        fullLabel: t('cashier.companyPayments'),
        value: parseUsdAmount(breakdown.purchasePayments),
        fill: FLOW_COLORS.purchase,
      },
      {
        id: 'returns',
        shortLabel: t('cashier.chartLabel.returns'),
        fullLabel: t('cashier.saleReturnsCash'),
        value: parseUsdAmount(breakdown.saleReturns),
        fill: FLOW_COLORS.saleReturn,
      },
      {
        id: 'staff-debt',
        shortLabel: t('cashier.chartLabel.staffDebt'),
        fullLabel: t('cashier.debtEffect'),
        value: Math.abs(parseUsdAmount(summary.employee_debt_cash_effect_usd)),
        fill: FLOW_COLORS.debt,
      },
    ].filter((row) => row.value > 0.0001)
  }, [breakdown, summary, t])

  const pieChartData = useMemo(() => {
    if (!summary || !breakdown) return []
    const inTotal =
      parseUsdAmount(summary.opening_cash_usd) +
      parseUsdAmount(breakdown.posSales) +
      parseUsdAmount(breakdown.customerDebtReceipts) +
      Math.max(0, -parseUsdAmount(summary.employee_debt_cash_effect_usd))
    const outTotal =
      parseUsdAmount(summary.expenses_usd) +
      parseUsdAmount(breakdown.purchasePayments) +
      parseUsdAmount(breakdown.saleReturns) +
      Math.max(0, parseUsdAmount(summary.employee_debt_cash_effect_usd))
    return [
      { name: t('cashier.chartInflows'), value: inTotal, fill: FLOW_COLORS.sales },
      { name: t('cashier.chartOutflows'), value: outTotal, fill: FLOW_COLORS.expenses },
    ].filter((row) => row.value > 0.0001)
  }, [breakdown, summary, t])

  const ledgerChartData = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>()
    for (const row of ledger) {
      const day = row.occurred_on
      const cur = map.get(day) ?? { in: 0, out: 0 }
      const amt = parseUsdAmount(row.amount_usd)
      if (row.direction === 'in') cur.in += amt
      else if (row.direction === 'out') cur.out += amt
      map.set(day, cur)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        label: formatDayLabel(date),
        in: v.in,
        out: v.out,
        net: v.in - v.out,
      }))
  }, [ledger])

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
      case 'sale_return_debt_reduction':
        return { to: '/sales-returns', label: t('cashier.ledgerColAction') }
      case 'purchase_payment':
        return { to: '/manage/purchases', label: t('cashier.ledgerColAction') }
      case 'opening_cash':
        return canEditOpening ? { to: '/manage/opening-cash', label: t('cashier.editOpening') } : null
      default:
        return null
    }
  }

  function kindBadgeClass(kind: CashierLedgerEntry['kind']): string {
    switch (kind) {
      case 'sale_payment':
      case 'customer_debt_payment':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      case 'purchase_payment':
        return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
      case 'expense':
      case 'sale_return':
        return 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
      case 'sale_return_debt_reduction':
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
      case 'employee_debt':
        return 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
      default:
        return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
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
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t('pos.emailPlaceholder')}
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            placeholder={t('pos.passwordPlaceholder')}
            autoComplete="current-password"
            required
          />
          {loginError && <p className="text-sm text-red-600">{loginError}</p>}
          <button type="submit" className="w-full rounded-xl bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500">
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
    <div className="mx-auto max-w-6xl px-3 pb-14 pt-4 text-start text-slate-900 dark:text-slate-100 sm:px-4 sm:pt-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-violet-700 to-emerald-700 p-5 shadow-lg shadow-violet-900/10 dark:border-violet-900/40 sm:p-7">
        <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
              <Vault className="h-3.5 w-3.5" aria-hidden />
              {t('cashier.title')}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('cashier.vaultOverview')}
            </h1>
            {summary?.date_from && summary?.date_to ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-violet-100/90">
                <CalendarRange className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="font-mono text-xs sm:text-sm">
                  {summary.date_from} → {summary.date_to}
                </span>
              </p>
            ) : null}
          </div>
          {canViewProfitReport ? (
            <Link
              to="/profit"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              {t('cashier.embeddedProfitFullLink')}
            </Link>
          ) : null}
        </div>

        {summary ? (
          <div className="relative mt-6 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            <p className="text-sm font-medium text-emerald-100">{t('cashier.netCash')}</p>
            <p className="mt-1 font-mono text-4xl font-bold tabular-nums tracking-tight text-white sm:text-5xl" dir="ltr">
              {formatMoneyCompact(summary.current_cash_usd)}{' '}
              <span className="text-2xl font-semibold text-white/80 sm:text-3xl">USD</span>
            </p>
            {currentCashIqd != null ? (
              <p className="mt-1 font-mono text-base tabular-nums text-emerald-100/95 sm:text-lg" dir="ltr">
                ≈ {currentCashIqd} IQD
              </p>
            ) : null}
          </div>
        ) : (
          <p className="relative mt-5 text-sm text-violet-100/80">{t('cashier.rateBoxBeforeCalc')}</p>
        )}
      </div>

      {/* Filters */}
      <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { preset: 'today' as const, labelKey: 'dash.today', activeClass: 'border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-900/50 dark:text-violet-200' },
              { preset: 'week' as const, labelKey: 'dash.thisWeek', activeClass: 'border-sky-400 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-900/50 dark:text-sky-200' },
              { preset: 'month' as const, labelKey: 'dash.thisMonth', activeClass: 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-200' },
              { preset: 'year' as const, labelKey: 'dash.thisYear', activeClass: 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-200' },
            ] as const
          ).map(({ preset, labelKey, activeClass }) => {
            const isActive = activePreset === preset
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applyDatePreset(preset)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? activeClass
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:bg-violet-950/40 dark:hover:text-violet-300'
                }`}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end">
          <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>{t('dash.from')}</span>
            <input
              type="date"
              value={dFrom}
              onChange={(e) => setDFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="flex min-w-[9.5rem] flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
            <span>{t('dash.to')}</span>
            <input
              type="date"
              value={dTo}
              onChange={(e) => setDTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            {loading ? t('common.loading') : t('cashier.calculate')}
          </button>
        </div>
        {summary ? (
          <p
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              summary.usd_to_iqd
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <Banknote className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {summary.usd_to_iqd
              ? t('cashier.rateBanner').replace(
                  '{iqd}',
                  Math.round(parseFloat(summary.usd_to_iqd) * 100).toLocaleString('en-US'),
                )
              : t('cashier.noExchangeRate')}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          {breakdown ? <CashierMetricsPanel summary={summary} breakdown={breakdown} t={t} /> : null}

          {/* Charts */}
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5 lg:col-span-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('cashier.chartFlowTitle')}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('cashier.chartFlowHint')}</p>
              {barChartData.length > 0 ? (
                <>
                  <div className="mt-4">
                    <CashFlowBreakdownChart
                      data={barChartData}
                      isDark={isDark}
                      isRtl={isRtl}
                      axisTick={axisTick}
                      gridStroke={gridStroke}
                    />
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
                    {barChartData.map((row) => (
                      <li
                        key={row.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.fill }} />
                        <span className="font-medium">{row.shortLabel}</span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400" dir="ltr">
                          {formatUsdShort(row.value)}$
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('cashier.chartEmpty')}</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('cashier.chartCompositionTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('cashier.chartCompositionHint')}</p>
              {pieChartData.length > 0 ? (
                <div className="mt-2 h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {pieChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} stroke={isDark ? '#0f172a' : '#fff'} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip isDark={isDark} />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: axisTick }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">{t('cashier.chartEmpty')}</p>
              )}
            </section>
          </div>

          {ledgerChartData.length > 0 ? (
            <section className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('cashier.chartLedgerTitle')}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('cashier.chartLedgerHint')}</p>
              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ledgerChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashInGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={FLOW_COLORS.sales} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={FLOW_COLORS.sales} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="cashOutGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={FLOW_COLORS.expenses} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={FLOW_COLORS.expenses} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axisTick, fontSize: 11 }} />
                    <YAxis tick={{ fill: axisTick, fontSize: 11 }} tickFormatter={formatUsdShort} width={48} />
                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: axisTick }} />
                    <Area
                      type="monotone"
                      dataKey="in"
                      name={t('cashier.chartInflows')}
                      stroke={FLOW_COLORS.sales}
                      fill="url(#cashInGrad)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="out"
                      name={t('cashier.chartOutflows')}
                      stroke={FLOW_COLORS.expenses}
                      fill="url(#cashOutGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          {/* Reconciliation */}
          <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('cashier.sectionCashReconciliation')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t('cashier.formula')}</p>
              </div>
              {canEditOpening ? (
                <Link
                  to="/manage/opening-cash"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/50"
                >
                  <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                  {t('cashier.openingManageLink')}
                </Link>
              ) : null}
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" aria-hidden />
                  {t('cashier.sectionInflows')}
                </h3>
                <div className="space-y-2.5">
                  {inflowRows.map((row) => (
                    <ReconciliationBar
                      key={row.key}
                      row={row}
                      maxValue={maxReconciliation}
                      usdToIqd={summary.usd_to_iqd}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                  {t('cashier.sectionOutflows')}
                </h3>
                <div className="space-y-2.5">
                  {outflowRows.length > 0 ? (
                    outflowRows.map((row) => (
                      <ReconciliationBar
                        key={row.key}
                        row={row}
                        maxValue={maxReconciliation}
                        usdToIqd={summary.usd_to_iqd}
                      />
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-center text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                      —
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white p-4 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-900">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{t('cashier.netCash')}</p>
                  {currentCashIqd != null ? (
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-emerald-700/80 dark:text-emerald-400/80" dir="ltr">
                      ≈ {currentCashIqd} IQD
                    </p>
                  ) : null}
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums text-emerald-800 dark:text-emerald-300" dir="ltr">
                  {formatMoneyCompact(summary.current_cash_usd)} USD
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('cashier.sectionOutstanding')}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('cashier.sectionOutstandingHint')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <OutstandingCard
                label={t('cashier.customerDebt')}
                value={summary.customer_debt_usd}
                usdToIqd={summary.usd_to_iqd}
                tone="emerald"
              />
              <OutstandingCard
                label={t('cashier.supplierDebt')}
                value={summary.supplier_debt_usd}
                usdToIqd={summary.usd_to_iqd}
                tone="sky"
              />
              <OutstandingCard
                label={t('cashier.employeeDebtBalance')}
                value={summary.employee_debt_outstanding_usd}
                usdToIqd={summary.usd_to_iqd}
                tone="amber"
              />
              <OutstandingCard
                label={t('cashier.salesInvoiced')}
                value={summary.sales_invoiced_usd}
                usdToIqd={summary.usd_to_iqd}
                hint={t('cashier.salesInvoicedHint')}
                tone="violet"
              />
              <OutstandingCard
                label={t('cashier.purchasesGoods')}
                value={summary.purchases_goods_usd}
                usdToIqd={summary.usd_to_iqd}
                hint={t('cashier.purchasesGoodsHint')}
                tone="violet"
              />
            </div>
          </section>

          {/* Ledger */}
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/40 sm:px-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('cashier.ledgerTitle')}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('cashier.contentHint')}</p>
            </div>
            {ledger.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t('cashier.noLedger')}</p>
            ) : (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {ledger.map((row) => {
                    const target = editTarget(row)
                    const sign = row.direction === 'out' ? '−' : row.direction === 'in' ? '+' : ''
                    const isIn = row.direction === 'in'
                    const isOut = row.direction === 'out'
                    return (
                      <article
                        key={`${row.kind}-${row.id}-${row.occurred_on}-m`}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${kindBadgeClass(row.kind)}`}>
                              {ledgerKindLabel(row.kind)}
                            </span>
                            <p className="mt-1.5 truncate text-sm text-slate-800 dark:text-slate-100">
                              {row.label || '—'}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : row.occurred_on}
                            </p>
                          </div>
                          <div className="shrink-0 text-end">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                                isIn
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : isOut
                                    ? 'bg-rose-500/15 text-rose-600'
                                    : 'bg-violet-500/15 text-violet-600'
                              }`}
                            >
                              {isIn ? (
                                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
                              ) : isOut ? (
                                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                              ) : (
                                <Plus className="h-3.5 w-3.5" aria-hidden />
                              )}
                            </span>
                            <p
                              className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                                isOut
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isIn
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-slate-800 dark:text-slate-200'
                              }`}
                              dir="ltr"
                            >
                              {sign}
                              {formatMoneyCompact(row.amount_usd)}
                            </p>
                          </div>
                        </div>
                        {target ? (
                          <Link
                            to={target.to}
                            className="mt-2 inline-block text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                          >
                            {target.label}
                          </Link>
                        ) : null}
                      </article>
                    )
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-start text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th className="px-5 py-3">{t('cashier.ledgerColDate')}</th>
                        <th className="px-5 py-3">{t('cashier.ledgerColKind')}</th>
                        <th className="px-5 py-3">{t('cashier.ledgerColLabel')}</th>
                        <th className="px-5 py-3 text-end">{t('cashier.ledgerColAmount')}</th>
                        <th className="w-0 px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row) => {
                        const target = editTarget(row)
                        const sign = row.direction === 'out' ? '−' : row.direction === 'in' ? '+' : ''
                        const amountClass =
                          row.direction === 'out'
                            ? 'text-rose-600 dark:text-rose-400'
                            : row.direction === 'in'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-800 dark:text-slate-200'
                        return (
                          <tr
                            key={`${row.kind}-${row.id}-${row.occurred_on}`}
                            className="border-b border-slate-50 transition hover:bg-slate-50/80 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800/40"
                          >
                            <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                              {row.occurred_at ? new Date(row.occurred_at).toLocaleString() : row.occurred_on}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${kindBadgeClass(row.kind)}`}
                              >
                                {ledgerKindLabel(row.kind)}
                              </span>
                              <span className="ms-1.5 text-xs text-slate-400">({directionLabel(row.direction)})</span>
                            </td>
                            <td className="max-w-[240px] truncate px-5 py-3 text-slate-700 dark:text-slate-300">
                              {row.label || '—'}
                            </td>
                            <td className={`px-5 py-3 text-end font-mono text-sm font-semibold tabular-nums ${amountClass}`} dir="ltr">
                              {sign}
                              {formatMoneyCompact(row.amount_usd)}
                            </td>
                            <td className="px-5 py-3">
                              {target ? (
                                <Link
                                  to={target.to}
                                  className="text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
                                >
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
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
