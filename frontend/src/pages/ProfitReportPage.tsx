import {
  CalendarRange,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
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
import { SaleLossBadge } from '../components/sales/SaleLossBadge'
import { useLocale } from '../context/LocaleContext'
import { useTheme } from '../context/ThemeContext'
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

const PROFIT_COLORS = {
  sales: '#10b981',
  cogs: '#f43f5e',
  discounts: '#f59e0b',
  expenses: '#ef4444',
  company: '#06b6d4',
  net: '#8b5cf6',
  gross: '#6366f1',
} as const

function formatUsdShort(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(abs >= 100 ? 0 : 2).replace(/\.?0+$/, '')
}

type WaterfallRow = {
  id: string
  shortLabel: string
  fullLabel: string
  value: number
  fill: string
}

function BreakdownBar({
  label,
  value,
  maxValue,
  tone = 'neutral',
  prefix,
  accent,
}: {
  label: string
  value: string
  maxValue: number
  tone?: 'neutral' | 'positive' | 'negative' | 'emphasis'
  prefix?: string
  accent: string
}) {
  const amount = parseReportNumber(value)
  const widthPct = maxValue > 0 ? Math.min(100, (Math.abs(amount) / maxValue) * 100) : 0
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-rose-700 dark:text-rose-400'
        : tone === 'emphasis'
          ? 'text-violet-800 dark:text-violet-300'
          : 'text-slate-900 dark:text-slate-100'

  return (
    <div className="rounded-xl border border-slate-100/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${widthPct}%`, backgroundColor: accent }}
            />
          </div>
        </div>
        <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${valueClass}`} dir="ltr">
          {prefix}
          {formatMoneyCompact(value)}
        </span>
      </div>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  isDark,
}: {
  active?: boolean
  payload?: { payload?: WaterfallRow; name?: string; value?: number; color?: string }[]
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (row?.fullLabel) {
    return (
      <div
        className={`rounded-xl border px-3 py-2.5 text-xs shadow-xl ${
          isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="mb-1 max-w-[14rem] font-semibold leading-snug">{row.fullLabel}</p>
        <p className="font-mono text-sm font-bold tabular-nums" style={{ color: row.fill }}>
          {formatMoneyCompact(String(row.value))} USD
        </p>
      </div>
    )
  }
  const p = payload[0]
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs shadow-xl ${
        isDark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      <p className="font-mono tabular-nums" style={{ color: p?.color }}>
        {p?.name}: {formatUsdShort(Number(p?.value ?? 0))} USD
      </p>
    </div>
  )
}

function ProfitWaterfallChart({
  data,
  isDark,
  isRtl,
  axisTick,
  gridStroke,
}: {
  data: WaterfallRow[]
  isDark: boolean
  isRtl: boolean
  axisTick: string
  gridStroke: string
}) {
  const height = Math.max(260, data.length * 46 + 24)
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: isRtl ? 12 : 52, left: isRtl ? 52 : 12, bottom: 4 }}
          barCategoryGap="16%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
          <XAxis type="number" tick={{ fill: axisTick, fontSize: 11 }} tickFormatter={formatUsdShort} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="shortLabel"
            width={76}
            orientation={isRtl ? 'right' : 'left'}
            tick={{ fill: axisTick, fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.12)' }} />
          <Bar dataKey="value" radius={isRtl ? [8, 0, 0, 8] : [0, 8, 8, 0]} barSize={20} maxBarSize={26}>
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="value"
              position={isRtl ? 'left' : 'right'}
              formatter={(v) => `${formatUsdShort(Number(v ?? 0))} $`}
              fill={axisTick}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const DATE_PRESETS: {
  preset: DatePreset
  labelKey: string
  activeClass: string
}[] = [
  { preset: 'today', labelKey: 'dash.today', activeClass: 'border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-500 dark:bg-violet-900/50 dark:text-violet-200' },
  { preset: 'week', labelKey: 'dash.thisWeek', activeClass: 'border-sky-400 bg-sky-100 text-sky-800 dark:border-sky-500 dark:bg-sky-900/50 dark:text-sky-200' },
  { preset: 'month', labelKey: 'dash.thisMonth', activeClass: 'border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-900/50 dark:text-emerald-200' },
  { preset: 'year', labelKey: 'dash.thisYear', activeClass: 'border-amber-400 bg-amber-100 text-amber-800 dark:border-amber-500 dark:bg-amber-900/50 dark:text-amber-200' },
]

export function ProfitReportPage() {
  const { t, isRtl } = useLocale()
  const { resolvedMode } = useTheme()
  const isDark = resolvedMode === 'dark'
  const axisTick = isDark ? '#94a3b8' : '#64748b'
  const gridStroke = isDark ? '#334155' : '#e2e8f0'

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

  const activePreset = useMemo((): DatePreset | null => {
    for (const preset of ['today', 'week', 'month', 'year'] as const) {
      const { start, end } = resolveDatePresetRange(preset)
      if (dFrom === start && dTo === end) return preset
    }
    return null
  }, [dFrom, dTo])

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

  const waterfallData = useMemo((): WaterfallRow[] => {
    if (!report?.totals) return []
    const totals = report.totals
    const invLoss = parseReportNumber(totals.total_inventory_loss_usd ?? '0')
    const operating =
      totals.total_operating_expenses_usd ??
      String(parseReportNumber(totals.total_expenses_usd) - invLoss)
    return [
      {
        id: 'sales',
        shortLabel: t('profit.chartLabel.sales'),
        fullLabel: t('profit.saleLinePrices'),
        value: parseReportNumber(totals.sum_sale_line_prices_usd),
        fill: PROFIT_COLORS.sales,
      },
      {
        id: 'cogs',
        shortLabel: t('profit.chartLabel.cogs'),
        fullLabel: t('profit.lineBuyCogs'),
        value: parseReportNumber(totals.total_purchases_goods_usd ?? '0'),
        fill: PROFIT_COLORS.cogs,
      },
      {
        id: 'discounts',
        shortLabel: t('profit.chartLabel.discounts'),
        fullLabel: t('profit.customerDiscounts'),
        value: parseReportNumber(totals.total_customer_discounts_usd),
        fill: PROFIT_COLORS.discounts,
      },
      {
        id: 'expenses',
        shortLabel: t('profit.chartLabel.expenses'),
        fullLabel: t('profit.operatingExpenses'),
        value: parseReportNumber(operating) + invLoss,
        fill: PROFIT_COLORS.expenses,
      },
      {
        id: 'company',
        shortLabel: t('profit.chartLabel.companyDiscount'),
        fullLabel: t('profit.companyDiscountsReceived'),
        value: parseReportNumber(totals.total_company_discounts_received_usd),
        fill: PROFIT_COLORS.company,
      },
      {
        id: 'net',
        shortLabel: t('profit.chartLabel.net'),
        fullLabel: t('profit.netProfit'),
        value: Math.abs(parseReportNumber(totals.net_profit_usd)),
        fill: PROFIT_COLORS.net,
      },
    ].filter((row) => row.value > 0.0001)
  }, [report, t])

  const compositionData = useMemo(() => {
    if (!report?.totals) return []
    const totals = report.totals
    const sales = parseReportNumber(totals.sum_sale_line_prices_usd)
    const net = parseReportNumber(totals.net_profit_usd)
    const deductions = Math.max(0, sales - net)
    return [
      { name: t('profit.chartRevenue'), value: sales, fill: PROFIT_COLORS.sales },
      { name: t('profit.chartDeductions'), value: deductions, fill: PROFIT_COLORS.cogs },
      ...(Math.abs(net) > 0.0001
        ? [{ name: t('profit.chartLabel.net'), value: Math.abs(net), fill: PROFIT_COLORS.net }]
        : []),
    ].filter((row) => row.value > 0.0001)
  }, [report, t])

  const topProductsData = useMemo(() => {
    const source = report?.lines ?? []
    return [...source]
      .sort((a, b) => parseReportNumber(b.net_profit_usd) - parseReportNumber(a.net_profit_usd))
      .slice(0, 8)
      .map((row, idx) => ({
        id: `${row.product_id}-${idx}`,
        name: row.product_name.length > 22 ? `${row.product_name.slice(0, 20)}…` : row.product_name,
        fullName: row.product_name,
        profit: parseReportNumber(row.net_profit_usd),
        fill: parseReportNumber(row.net_profit_usd) >= 0 ? PROFIT_COLORS.sales : PROFIT_COLORS.cogs,
      }))
      .filter((row) => row.profit !== 0 || source.length <= 8)
  }, [report?.lines])

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
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('pos.passwordPlaceholder')}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
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
  const purchasesGoodsUsd = totals?.total_purchases_goods_usd ?? '0'
  const grossMargin =
    totals?.gross_margin_purchases_usd ??
    String(
      parseReportNumber(totals?.sum_sale_line_prices_usd ?? '0') -
        parseReportNumber(purchasesGoodsUsd),
    )
  const maxBreakdown = totals
    ? Math.max(
        parseReportNumber(totals.sum_sale_line_prices_usd),
        parseReportNumber(purchasesGoodsUsd),
        parseReportNumber(grossMargin),
        parseReportNumber(totals.net_profit_usd),
        1,
      )
    : 1

  return (
    <div className="min-h-dvh bg-[var(--app-bg-color,#f1f5f9)] dark:bg-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-6xl px-3 py-4 pb-14 sm:px-4 sm:py-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-violet-200/60 bg-gradient-to-br from-violet-600 via-violet-700 to-emerald-700 p-5 shadow-lg shadow-violet-900/10 dark:border-violet-900/40 sm:p-7">
          <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                {t('nav.profit')}
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {t('profit.netProfit')}
              </h1>
              {report ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-violet-100/90">
                  <CalendarRange className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  <span className="font-mono text-xs sm:text-sm">
                    {report.date_from} → {report.date_to}
                  </span>
                </p>
              ) : null}
            </div>
            {totals ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-end backdrop-blur-md">
                <p
                  className={`font-mono text-3xl font-bold tabular-nums sm:text-4xl ${netProfitCellClass(totals.net_profit_usd).replace('text-', 'text-white ')}`}
                  dir="ltr"
                  style={{ color: parseReportNumber(totals.net_profit_usd) >= 0 ? '#ecfdf5' : '#fecaca' }}
                >
                  {formatMoneyCompact(totals.net_profit_usd)}
                  <span className="ms-2 text-lg font-semibold text-white/80">USD</span>
                </p>
                {netIqd ? (
                  <p className="mt-1 font-mono text-sm tabular-nums text-emerald-100/95" dir="ltr">
                    ≈ {netIqd} IQD
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-violet-100/70">{t('profit.iqdNoRate')}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Filters */}
        <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map(({ preset, labelKey, activeClass }) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activePreset === preset
                    ? activeClass
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {me.is_superuser && (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs dark:border-slate-600 dark:bg-slate-800/50">
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
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.from')}</span>
              <input
                type="date"
                value={dFrom}
                onChange={(e) => setDFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('dash.to')}</span>
              <input
                type="date"
                value={dTo}
                onChange={(e) => setDTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void fetchReport()}
                disabled={loading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                {loading ? t('common.loading') : t('dash.apply')}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </p>
        )}

        {report && totals && (
          <>
            {/* KPI strip */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: t('profit.saleLinePrices'), value: totals.sum_sale_line_prices_usd, icon: TrendingUp, color: PROFIT_COLORS.sales },
                { label: t('profit.lineBuyCogs'), value: purchasesGoodsUsd, icon: TrendingDown, color: PROFIT_COLORS.cogs },
                { label: t('profit.grossMargin'), value: grossMargin, icon: Wallet, color: PROFIT_COLORS.gross },
                { label: t('profit.netProfit'), value: totals.net_profit_usd, icon: TrendingUp, color: PROFIT_COLORS.net },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${kpi.color}22`, color: kpi.color }}
                    >
                      <kpi.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{kpi.label}</p>
                      <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white" dir="ltr">
                        {formatMoneyCompact(kpi.value)} <span className="text-[11px] font-semibold text-slate-500">USD</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5 lg:col-span-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('profit.chartWaterfallTitle')}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('profit.chartWaterfallHint')}</p>
                {waterfallData.length > 0 ? (
                  <div className="mt-4">
                    <ProfitWaterfallChart
                      data={waterfallData}
                      isDark={isDark}
                      isRtl={isRtl}
                      axisTick={axisTick}
                      gridStroke={gridStroke}
                    />
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">{t('profit.chartEmpty')}</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('profit.chartCompositionTitle')}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('profit.chartCompositionHint')}</p>
                {compositionData.length > 0 ? (
                  <div className="mt-2 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={compositionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={82}
                          paddingAngle={3}
                        >
                          {compositionData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} stroke={isDark ? '#0f172a' : '#fff'} strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip isDark={isDark} />} />
                        <Legend wrapperStyle={{ fontSize: 12, color: axisTick }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">{t('profit.chartEmpty')}</p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('profit.chartTopProductsTitle')}</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('profit.chartTopProductsHint')}</p>
                {topProductsData.length > 0 ? (
                  <div className="mt-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProductsData}
                        layout="vertical"
                        margin={{ top: 4, right: isRtl ? 12 : 44, left: isRtl ? 44 : 12, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                        <XAxis type="number" tick={{ fill: axisTick, fontSize: 11 }} tickFormatter={formatUsdShort} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={88}
                          orientation={isRtl ? 'right' : 'left'}
                          tick={{ fill: axisTick, fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null
                            const row = payload[0].payload as { fullName: string; profit: number; fill: string }
                            return (
                              <div className={`rounded-xl border px-3 py-2 text-xs shadow-xl ${isDark ? 'border-slate-600 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
                                <p className="font-semibold">{row.fullName}</p>
                                <p className="font-mono font-bold tabular-nums" style={{ color: row.fill }}>
                                  {formatMoneyCompact(String(row.profit))} USD
                                </p>
                              </div>
                            )
                          }}
                        />
                        <Bar dataKey="profit" radius={isRtl ? [8, 0, 0, 8] : [0, 8, 8, 0]} barSize={18}>
                          {topProductsData.map((entry) => (
                            <Cell key={entry.id} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="mt-8 text-center text-sm text-slate-500">{t('profit.noSalesInRange')}</p>
                )}
              </section>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">{t('profit.totalsUsd')}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('profit.summaryFormulaHint')}</p>
                <div className="mt-4 space-y-2">
                  <BreakdownBar label={t('profit.saleLinePrices')} value={totals.sum_sale_line_prices_usd} maxValue={maxBreakdown} accent={PROFIT_COLORS.sales} />
                  <BreakdownBar label={t('profit.lineBuyCogs')} value={purchasesGoodsUsd} maxValue={maxBreakdown} tone="negative" prefix="−" accent={PROFIT_COLORS.cogs} />
                  <BreakdownBar label={t('profit.grossMargin')} value={grossMargin} maxValue={maxBreakdown} tone="emphasis" accent={PROFIT_COLORS.gross} />
                  <BreakdownBar label={t('profit.customerDiscounts')} value={totals.total_customer_discounts_usd} maxValue={maxBreakdown} tone="negative" prefix="−" accent={PROFIT_COLORS.discounts} />
                  <BreakdownBar label={t('profit.operatingExpenses')} value={operatingExpenses} maxValue={maxBreakdown} tone="negative" prefix="−" accent={PROFIT_COLORS.expenses} />
                  {inventoryLoss > 0 ? (
                    <BreakdownBar label={t('profit.inventoryLoss')} value={totals.total_inventory_loss_usd ?? '0'} maxValue={maxBreakdown} tone="negative" prefix="−" accent={PROFIT_COLORS.cogs} />
                  ) : null}
                  <BreakdownBar label={t('profit.companyDiscountsReceived')} value={totals.total_company_discounts_received_usd} maxValue={maxBreakdown} tone="positive" prefix="+" accent={PROFIT_COLORS.company} />
                  <div className="rounded-xl border border-violet-200/70 bg-violet-50/50 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                    <BreakdownBar label={t('profit.netProfit')} value={totals.net_profit_usd} maxValue={maxBreakdown} tone="emphasis" accent={PROFIT_COLORS.net} />
                  </div>
                </div>
              </section>

              {!report.global_multi_shop && report.profit_distribution.length > 0 ? (
                <section className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-violet-900 dark:text-violet-200">
                    <Users className="h-5 w-5 shrink-0" aria-hidden />
                    {t('profit.dist')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('profit.distHint')}</p>
                  <ul className="mt-4 space-y-2">
                    {report.profit_distribution.map((row) => (
                      <li
                        key={row.shareholder_id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-violet-100/80 bg-white/80 px-3 py-3 dark:border-violet-900/30 dark:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className="text-xs text-slate-500">
                            {t('profit.shPct')}: {row.share_percentage}%
                          </p>
                        </div>
                        <p
                          className={`shrink-0 font-mono text-sm font-bold tabular-nums ${netProfitCellClass(row.profit_share_usd)}`}
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

            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
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
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 ps-9 pe-3 text-sm dark:border-slate-600 dark:bg-slate-900"
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
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
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
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    >
                      <option value="profit_desc">{t('profit.sortProfitDesc')}</option>
                      <option value="profit_asc">{t('profit.sortProfitAsc')}</option>
                      <option value="name">{t('profit.sortName')}</option>
                      <option value="qty_desc">{t('profit.sortQtyDesc')}</option>
                      <option value="sale_desc">{t('profit.sortSaleDesc')}</option>
                    </select>
                  </label>
                  <label className="flex min-h-[42px] items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900">
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
                        className={`border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-700/80 dark:hover:bg-slate-800/40 ${
                          idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''
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
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500 dark:bg-slate-800">
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
                          className={`px-4 py-3 font-mono font-semibold tabular-nums ${netProfitCellClass(row.net_profit_usd)}`}
                        >
                          {formatMoneyCompact(row.net_profit_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLines.length === 0 && (
                  <p className="px-4 py-12 text-center text-sm text-slate-500">
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
