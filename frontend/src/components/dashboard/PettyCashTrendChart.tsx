import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '../../context/ThemeContext'
import type { PettyCashTrendResponse } from '../../types/api'

function formatUsdShort(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toFixed(abs >= 100 ? 0 : 2).replace(/\.?0+$/, '')
}

function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso.slice(5)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

type ChartRow = {
  date: string
  label: string
  value: number
}

export type PettyCashRangePreset = '7' | '14' | '30' | 'all' | 'custom'

export function buildPettyCashTrendQuery(
  preset: PettyCashRangePreset,
  customFrom?: string,
  customTo?: string,
): string {
  if (preset === 'custom' && customFrom?.trim() && customTo?.trim()) {
    return `from=${encodeURIComponent(customFrom.trim())}&to=${encodeURIComponent(customTo.trim())}`
  }
  if (preset === 'all') return 'days=365'
  return `days=${preset}`
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function presetFromQuery(query: string): PettyCashRangePreset {
  if (query.startsWith('from=')) return 'custom'
  const m = query.match(/days=(\d+)/)
  if (!m) return '30'
  const n = m[1]
  if (n === '7') return '7'
  if (n === '14') return '14'
  if (n === '365') return 'all'
  return '30'
}

function formatUsd2dp(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

function chartAnimationMs(pointCount: number): number {
  return Math.min(2600, Math.max(1100, 700 + pointCount * 45))
}

function PeakDotShape({
  cx,
  cy,
  isDark,
}: {
  cx?: number
  cy?: number
  isDark: boolean
}) {
  if (cx == null || cy == null) return null
  const stroke = isDark ? '#22d3ee' : '#06b6d4'
  return (
    <g className="petty-cash-peak-dot" transform={`translate(${cx}, ${cy})`}>
      <circle className="petty-cash-peak-halo" cx={0} cy={0} r={14} fill={stroke} opacity={0.22} />
      <circle cx={0} cy={0} r={6} fill="#ffffff" stroke={stroke} strokeWidth={3} />
    </g>
  )
}

function TrendTooltip({
  active,
  payload,
  currencyLabel,
  isDark,
}: {
  active?: boolean
  payload?: Array<{ payload?: ChartRow }>
  currencyLabel: string
  isDark: boolean
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div
      className={
        isDark
          ? 'rounded-xl border border-cyan-400/30 bg-slate-900/95 px-3 py-2 text-xs shadow-xl shadow-cyan-500/20 backdrop-blur-sm'
          : 'rounded-xl border border-cyan-200/90 bg-white/95 px-3 py-2 text-xs shadow-lg shadow-cyan-200/60 backdrop-blur-sm'
      }
    >
      <p className={`font-mono ${isDark ? 'text-cyan-100/80' : 'text-slate-500'}`}>{row.date}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {formatUsd2dp(row.value)} {currencyLabel}
      </p>
    </div>
  )
}

export function PettyCashTrendChart({
  data,
  loading = false,
  query,
  onQueryChange,
  dashboardPeriodCashUsd,
  dashboardDateFrom,
  dashboardDateTo,
  title,
  subtitle,
  currencyLabel,
  emptyLabel,
  todayLabel,
  rangeTotalLabel,
  range7Label,
  range14Label,
  range30Label,
  rangeAllLabel,
  rangeCustomLabel,
  fromLabel,
  toLabel,
  applyLabel,
}: {
  data: PettyCashTrendResponse | null
  loading?: boolean
  query: string
  onQueryChange: (query: string) => void
  dashboardPeriodCashUsd?: string | null
  dashboardDateFrom?: string
  dashboardDateTo?: string
  title: string
  subtitle: string
  currencyLabel: string
  emptyLabel: string
  todayLabel: string
  rangeTotalLabel: string
  range7Label: string
  range14Label: string
  range30Label: string
  rangeAllLabel: string
  rangeCustomLabel: string
  fromLabel: string
  toLabel: string
  applyLabel: string
}) {
  const { resolvedMode } = useTheme()
  const isDark = resolvedMode === 'dark'
  const [animateKey, setAnimateKey] = useState(0)
  const [preset, setPreset] = useState<PettyCashRangePreset>(() => presetFromQuery(query))
  const [customFrom, setCustomFrom] = useState(() => isoDaysAgo(29))
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [customOpen, setCustomOpen] = useState(() => presetFromQuery(query) === 'custom')

  useEffect(() => {
    setPreset(presetFromQuery(query))
    if (query.startsWith('from=')) {
      setCustomOpen(true)
      const params = new URLSearchParams(query)
      const from = params.get('from')
      const to = params.get('to')
      if (from) setCustomFrom(from)
      if (to) setCustomTo(to)
    }
  }, [query])

  const selectPreset = useCallback(
    (next: PettyCashRangePreset) => {
      setPreset(next)
      if (next === 'custom') {
        setCustomOpen(true)
        return
      }
      setCustomOpen(false)
      onQueryChange(buildPettyCashTrendQuery(next))
    },
    [onQueryChange],
  )

  const applyCustomRange = useCallback(() => {
    if (!customFrom.trim() || !customTo.trim()) return
    let from = customFrom.trim()
    let to = customTo.trim()
    if (from > to) [from, to] = [to, from]
    setCustomFrom(from)
    setCustomTo(to)
    setPreset('custom')
    setCustomOpen(true)
    onQueryChange(buildPettyCashTrendQuery('custom', from, to))
  }, [customFrom, customTo, onQueryChange])

  const chartRows = useMemo((): ChartRow[] => {
    return [...(data?.points ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({
        date: p.date,
        label: formatDayLabel(p.date),
        value: parseFloat(p.value_usd) || 0,
      }))
  }, [data])

  const peakIndex = useMemo(() => {
    if (!chartRows.length) return -1
    let best = 0
    chartRows.forEach((r, i) => {
      if (r.value >= chartRows[best].value) best = i
    })
    return best
  }, [chartRows])

  const lastChartDate = chartRows.length ? chartRows[chartRows.length - 1].date : ''
  const chartRangeTotal = useMemo(
    () => chartRows.reduce((sum, row) => sum + row.value, 0),
    [chartRows],
  )
  const todayValue = useMemo(() => {
    const lastPointValue = chartRows.length ? chartRows[chartRows.length - 1].value : 0
    const dashFrom = dashboardDateFrom?.trim() ?? ''
    const dashTo = dashboardDateTo?.trim() ?? ''
    const dashCash = parseFloat(dashboardPeriodCashUsd ?? '')
    if (
      dashFrom &&
      dashFrom === dashTo &&
      dashTo === lastChartDate &&
      Number.isFinite(dashCash)
    ) {
      return dashCash
    }
    return lastPointValue
  }, [chartRows, dashboardDateFrom, dashboardDateTo, dashboardPeriodCashUsd, lastChartDate])
  const seriesKey = data ? `${data.date_from}-${data.date_to}-${chartRows.length}` : 'empty'
  const lineAnimMs = chartAnimationMs(chartRows.length)

  useEffect(() => {
    setAnimateKey((k) => k + 1)
  }, [seriesKey])

  const chartTheme = useMemo(
    () =>
      isDark
        ? {
            gridStroke: 'rgba(167,139,250,0.12)',
            xTick: 'rgba(196,181,253,0.65)',
            yTick: 'rgba(196,181,253,0.55)',
            cursorStroke: 'rgba(34,211,238,0.35)',
            lineStops: [
              { offset: '0%', color: '#22d3ee' },
              { offset: '100%', color: '#a78bfa' },
            ],
            fillStops: [
              { offset: '0%', color: '#8b5cf6', opacity: 0.55 },
              { offset: '55%', color: '#6366f1', opacity: 0.22 },
              { offset: '100%', color: '#0f172a', opacity: 0.02 },
            ],
          }
        : {
            gridStroke: 'rgba(14,165,233,0.14)',
            xTick: 'rgba(71,85,105,0.72)',
            yTick: 'rgba(100,116,139,0.68)',
            cursorStroke: 'rgba(6,182,212,0.45)',
            lineStops: [
              { offset: '0%', color: '#06b6d4' },
              { offset: '100%', color: '#8b5cf6' },
            ],
            fillStops: [
              { offset: '0%', color: '#22d3ee', opacity: 0.38 },
              { offset: '45%', color: '#a78bfa', opacity: 0.22 },
              { offset: '100%', color: '#ffffff', opacity: 0.04 },
            ],
          },
    [isDark],
  )

  const presetBtnClass = (active: boolean) => {
    if (active) {
      return isDark
        ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100 shadow-sm shadow-cyan-500/20'
        : 'border-cyan-500 bg-cyan-600 text-white shadow-sm shadow-cyan-200/60'
    }
    return isDark
      ? 'border-violet-500/30 bg-violet-950/40 text-violet-100/85 hover:border-violet-400/45 hover:bg-violet-900/50'
      : 'border-slate-200 bg-white/80 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/80'
  }

  const shellClass = isDark
    ? 'relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-[#1a1033] via-[#151528] to-[#0f172a] p-5 shadow-lg shadow-violet-950/40 sm:p-6'
    : 'relative overflow-hidden rounded-2xl border border-cyan-200/90 bg-gradient-to-br from-white via-cyan-50/70 to-violet-100/40 p-5 shadow-lg shadow-cyan-100/50 ring-1 ring-cyan-100/80 sm:p-6'

  const rangeButtons: { id: PettyCashRangePreset; label: string }[] = [
    { id: '7', label: range7Label },
    { id: '14', label: range14Label },
    { id: '30', label: range30Label },
    { id: 'all', label: rangeAllLabel },
    { id: 'custom', label: rangeCustomLabel },
  ]

  if (!chartRows.length && !loading) {
    return (
      <div className={shellClass}>
        <FilterToolbar
          isDark={isDark}
          preset={preset}
          customOpen={customOpen}
          customFrom={customFrom}
          customTo={customTo}
          rangeButtons={rangeButtons}
          presetBtnClass={presetBtnClass}
          fromLabel={fromLabel}
          toLabel={toLabel}
          applyLabel={applyLabel}
          onSelectPreset={selectPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustom={applyCustomRange}
        />
        <div
          className={`mt-4 flex min-h-[220px] items-center justify-center rounded-xl text-sm ${
            isDark ? 'text-violet-200/70' : 'text-slate-500'
          }`}
        >
          {emptyLabel}
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      <style>{`
        @keyframes petty-cash-chart-enter {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes petty-cash-peak-pop {
          0% {
            opacity: 0;
            transform: scale(0);
          }
          65% {
            opacity: 1;
            transform: scale(1.18);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes petty-cash-peak-halo {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.22;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.06;
          }
        }
        .petty-cash-chart-enter {
          animation: petty-cash-chart-enter 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .petty-cash-peak-dot {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: petty-cash-peak-pop 0.75s cubic-bezier(0.34, 1.45, 0.64, 1) forwards;
          animation-delay: var(--petty-cash-peak-delay, 1.1s);
        }
        .petty-cash-peak-halo {
          transform-box: fill-box;
          transform-origin: center;
          animation: petty-cash-peak-halo 2.8s ease-in-out infinite;
          animation-delay: calc(var(--petty-cash-peak-delay, 1.1s) + 0.5s);
        }
        @media (prefers-reduced-motion: reduce) {
          .petty-cash-chart-enter,
          .petty-cash-peak-dot,
          .petty-cash-peak-halo {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
      <div
        className={`pointer-events-none absolute -start-10 -top-10 h-40 w-40 rounded-full blur-3xl ${
          isDark ? 'bg-violet-500/20' : 'bg-cyan-300/35'
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -bottom-12 -end-8 h-44 w-44 rounded-full blur-3xl ${
          isDark ? 'bg-cyan-400/15' : 'bg-violet-300/25'
        }`}
        aria-hidden
      />
      {!isDark ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_0%,rgba(34,211,238,0.12),transparent_55%)]"
          aria-hidden
        />
      ) : null}
      <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-start">
          <h2
            className={`text-base font-semibold sm:text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            {title}
          </h2>
          <p className={`mt-1 text-xs ${isDark ? 'text-violet-200/70' : 'text-slate-600'}`}>
            {subtitle}
            {data?.date_from && data?.date_to ? (
              <span className="ms-1 font-mono opacity-80">
                ({data.date_from} → {data.date_to})
              </span>
            ) : null}
          </p>
        </div>
        <div className="text-end">
          <p
            className={`text-[11px] font-semibold uppercase tracking-wide ${
              isDark ? 'text-cyan-300/70' : 'text-cyan-700/80'
            }`}
          >
            {todayLabel}
          </p>
          <p
            className={`text-2xl font-bold tabular-nums transition-opacity duration-300 ${
              isDark ? 'text-cyan-300' : 'text-cyan-600'
            } ${loading ? 'opacity-50' : 'opacity-100'}`}
          >
            {formatUsd2dp(todayValue)}
            <span
              className={`ms-1.5 text-sm font-medium ${
                isDark ? 'text-cyan-300/70' : 'text-cyan-700/80'
              }`}
            >
              {currencyLabel}
            </span>
          </p>
          {chartRows.length > 1 ? (
            <p className={`mt-1 text-xs tabular-nums ${isDark ? 'text-violet-200/65' : 'text-slate-500'}`}>
              {rangeTotalLabel}: {formatUsd2dp(chartRangeTotal)} {currencyLabel}
            </p>
          ) : null}
        </div>
      </div>
      <FilterToolbar
        isDark={isDark}
        preset={preset}
        customOpen={customOpen}
        customFrom={customFrom}
        customTo={customTo}
        rangeButtons={rangeButtons}
        presetBtnClass={presetBtnClass}
        fromLabel={fromLabel}
        toLabel={toLabel}
        applyLabel={applyLabel}
        onSelectPreset={selectPreset}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        onApplyCustom={applyCustomRange}
      />
      <div
        key={animateKey}
        className="petty-cash-chart-enter relative mt-4 h-[240px] w-full min-w-0 sm:h-[260px]"
        style={{ '--petty-cash-peak-delay': `${lineAnimMs * 0.55}ms` } as CSSProperties}
      >
        {loading ? (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center rounded-xl backdrop-blur-[1px] ${
              isDark ? 'bg-[#151528]/55' : 'bg-white/50'
            }`}
          >
            <div
              className={`h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${
                isDark ? 'border-cyan-400' : 'border-cyan-600'
              }`}
            />
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
          <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pettyCashLine" x1="0" y1="0" x2="1" y2="0">
                {chartTheme.lineStops.map((s) => (
                  <stop key={s.offset} offset={s.offset} stopColor={s.color} />
                ))}
              </linearGradient>
              <linearGradient id="pettyCashFill" x1="0" y1="0" x2="0" y2="1">
                {chartTheme.fillStops.map((s) => (
                  <stop
                    key={s.offset}
                    offset={s.offset}
                    stopColor={s.color}
                    stopOpacity={s.opacity}
                  />
                ))}
              </linearGradient>
              <filter id="pettyCashGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid
              stroke={chartTheme.gridStroke}
              strokeDasharray="4 6"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: chartTheme.xTick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: chartTheme.yTick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) => formatUsdShort(v)}
            />
            <Tooltip
              content={<TrendTooltip currencyLabel={currencyLabel} isDark={isDark} />}
              cursor={{ stroke: chartTheme.cursorStroke, strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#pettyCashLine)"
              strokeWidth={3}
              fill="url(#pettyCashFill)"
              dot={false}
              isAnimationActive={!loading}
              animationDuration={lineAnimMs}
              animationEasing="ease-out"
              animationBegin={60}
              activeDot={{
                r: 7,
                fill: '#ffffff',
                stroke: isDark ? '#22d3ee' : '#06b6d4',
                strokeWidth: 3,
                filter: 'url(#pettyCashGlow)',
                style: { transition: 'r 0.2s ease-out' },
              }}
            />
            {peakIndex >= 0 ? (
              <ReferenceDot
                x={chartRows[peakIndex].label}
                y={chartRows[peakIndex].value}
                shape={(props) => <PeakDotShape {...props} isDark={isDark} />}
                ifOverflow="extendDomain"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function FilterToolbar({
  isDark,
  preset,
  customOpen,
  customFrom,
  customTo,
  rangeButtons,
  presetBtnClass,
  fromLabel,
  toLabel,
  applyLabel,
  onSelectPreset,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustom,
}: {
  isDark: boolean
  preset: PettyCashRangePreset
  customOpen: boolean
  customFrom: string
  customTo: string
  rangeButtons: { id: PettyCashRangePreset; label: string }[]
  presetBtnClass: (active: boolean) => string
  fromLabel: string
  toLabel: string
  applyLabel: string
  onSelectPreset: (preset: PettyCashRangePreset) => void
  onCustomFromChange: (v: string) => void
  onCustomToChange: (v: string) => void
  onApplyCustom: () => void
}) {
  return (
    <div className="relative mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        {rangeButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => onSelectPreset(btn.id)}
            className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${presetBtnClass(
              preset === btn.id || (btn.id === 'custom' && customOpen && preset === 'custom'),
            )}`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      {customOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[9rem] flex-1">
            <span
              className={`mb-1 block text-xs font-medium ${isDark ? 'text-violet-200/80' : 'text-slate-600'}`}
            >
              {fromLabel}
            </span>
            <input
              type="date"
              dir="ltr"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className={`min-h-9 w-full rounded-lg border px-2 py-1.5 text-sm ${
                isDark
                  ? 'border-violet-500/35 bg-violet-950/50 text-violet-50'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            />
          </label>
          <label className="block min-w-[9rem] flex-1">
            <span
              className={`mb-1 block text-xs font-medium ${isDark ? 'text-violet-200/80' : 'text-slate-600'}`}
            >
              {toLabel}
            </span>
            <input
              type="date"
              dir="ltr"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className={`min-h-9 w-full rounded-lg border px-2 py-1.5 text-sm ${
                isDark
                  ? 'border-violet-500/35 bg-violet-950/50 text-violet-50'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            />
          </label>
          <button
            type="button"
            onClick={onApplyCustom}
            className={`min-h-9 shrink-0 rounded-lg px-4 py-2 text-xs font-semibold ${
              isDark
                ? 'bg-cyan-500/25 text-cyan-100 ring-1 ring-cyan-400/40 hover:bg-cyan-500/35'
                : 'bg-cyan-600 text-white hover:bg-cyan-500'
            }`}
          >
            {applyLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
