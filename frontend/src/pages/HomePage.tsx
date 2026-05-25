import {
  Activity,
  BarChart3,
  Banknote,
  ChevronLeft,
  Coins,
  DollarSign,
  Globe,
  LayoutDashboard,
  Package,
  PieChart as PieChartIcon,
  RotateCcw,
  ScanBarcode,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LangSwitcher } from '../components/LangSwitcher'
import { SuperuserDashboardScopeCard } from '../components/SuperuserDashboardScopeCard'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { getPersistedSuperuserShopId, readPosShopIdFromStorage } from '../lib/activeShop'
import {
  apiJson,
  getGlobalView,
  getSuperuserShopId,
  isApiStatus,
  setGlobalView,
  setSuperuserShopId,
} from '../lib/api'
import {
  fetchMerchantStorefrontOrderStats,
  type OnlineStorefrontOrderStats,
} from '../lib/merchantStorefrontApi'
import { hasPerm } from '../lib/permissions'
import type {
  AdminGlobalStats,
  DashboardStats,
  Paginated,
  ProductRow,
  ShopRow,
  ShopSettingsRow,
} from '../types/api'

const PRODUCT_DONUT_COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#0ea5e9',
  '#22c55e',
  '#f97316',
  '#ec4899',
]

function formatCompactNumber(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function formatDateInputValue(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type TopSellingProductRow = DashboardStats['top_selling_products'][number]

export function HomePage() {
  const { lang, setLang, t } = useLocale()
  const { me, login } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [dFrom, setDFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [dTo, setDTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [globalAdminStats, setGlobalAdminStats] = useState<AdminGlobalStats | null>(null)
  /** When superuser views a single shop (not global), still load all-shop rankings for comparison. */
  const [superuserShopRankings, setSuperuserShopRankings] = useState<AdminGlobalStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [statsForbidden, setStatsForbidden] = useState(false)
  const [onlineStats, setOnlineStats] = useState<OnlineStorefrontOrderStats | null>(null)
  const [loadingOnlineStats, setLoadingOnlineStats] = useState(false)
  const [topSellingFrom, setTopSellingFrom] = useState(() => new Date().toISOString().slice(0, 10))
  const [topSellingTo, setTopSellingTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [topSellingProducts, setTopSellingProducts] = useState<TopSellingProductRow[]>([])
  const [stockProducts, setStockProducts] = useState<ProductRow[]>([])
  const [loadingStockProducts, setLoadingStockProducts] = useState(false)
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false)
  const [shopLowStockThreshold, setShopLowStockThreshold] = useState(5)
  const [loadingTopSelling, setLoadingTopSelling] = useState(false)
  const [topSellingSearch, setTopSellingSearch] = useState('')
  const [topSellingSearchOpen, setTopSellingSearchOpen] = useState(false)
  const [topSellingLimit, setTopSellingLimit] = useState<'10' | '20' | '50' | 'all'>('10')
  const preservedScrollY = useRef<number | null>(null)

  const [scopeShopId, setScopeShopId] = useState(() => localStorage.getItem('pos_shop_id') ?? '')
  const [scopeGlobalView, setScopeGlobalView] = useState(() => getGlobalView())
  const [scopeShops, setScopeShops] = useState<ShopRow[]>([])

  const persistedSuperuserShopId = getPersistedSuperuserShopId()

  const showSuperuserScopeCard = Boolean(
    me?.is_superuser && !scopeGlobalView && !persistedSuperuserShopId,
  )

  const canFetchShopDashboardExtras = useMemo(() => {
    if (!me || getGlobalView()) return false
    if (me.is_superuser) {
      return Boolean(getPersistedSuperuserShopId())
    }
    return true
  }, [me, persistedSuperuserShopId])

  const syncSuperuserScope = useCallback(() => {
    const stored = readPosShopIdFromStorage() ?? ''
    const resolved = (getSuperuserShopId()?.trim() || stored).trim()
    setScopeShopId(resolved)
    setScopeGlobalView(getGlobalView())
    if (resolved) setSuperuserShopId(resolved)
  }, [])

  useEffect(() => {
    if (!me?.is_superuser) return
    syncSuperuserScope()
    void (async () => {
      try {
        const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/')
        setScopeShops(Array.isArray(data) ? data : data.results)
      } catch {
        setScopeShops([])
      }
    })()
  }, [me?.is_superuser, syncSuperuserScope])

  const applySuperuserScopeShop = useCallback(() => {
    const v = scopeShopId.trim()
    if (!v) return
    setGlobalView(false)
    setSuperuserShopId(v)
    localStorage.setItem('pos_shop_id', v)
    setScopeGlobalView(false)
    setScopeShopId(v)
    window.dispatchEvent(new Event('mm-dashboard-refresh'))
    window.dispatchEvent(new Event('mm-session-refresh'))
  }, [scopeShopId])

  const enableSuperuserScopeGlobalView = useCallback(() => {
    setGlobalView(true)
    setSuperuserShopId(null)
    localStorage.removeItem('pos_shop_id')
    setScopeGlobalView(true)
    setScopeShopId('')
    window.dispatchEvent(new Event('mm-dashboard-refresh'))
    window.dispatchEvent(new Event('mm-session-refresh'))
  }, [])

  const preserveScrollPosition = useCallback(() => {
    preservedScrollY.current = window.scrollY
  }, [])

  useLayoutEffect(() => {
    if (preservedScrollY.current === null) return
    const y = preservedScrollY.current
    preservedScrollY.current = null
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'auto' })
    })
  })

  const shouldFetchStats = useMemo(() => {
    if (!me) return false
    if (me.is_superuser) return true
    if (me.role === 'owner') return true
    return hasPerm(me, 'view_sale', 'view_report', 'view_expense')
  }, [me])

  useEffect(() => {
    setStatsForbidden(false)
  }, [me?.id, dFrom, dTo])

  const fetchStats = useCallback(async () => {
    if (!shouldFetchStats || statsForbidden) return
    if (me?.is_superuser && !getGlobalView() && !getPersistedSuperuserShopId()) {
      setStats(null)
      setGlobalAdminStats(null)
      setSuperuserShopRankings(null)
      return
    }
    setLoadingStats(true)
    setError(null)
    try {
      const q = `?from=${encodeURIComponent(dFrom)}&to=${encodeURIComponent(dTo)}`
      if (me?.is_superuser && getGlobalView()) {
        const g = await apiJson<AdminGlobalStats>(`/api/admin/stats/${q}`)
        setGlobalAdminStats(g)
        setStats(null)
        setSuperuserShopRankings(null)
      } else {
        const shopScoped = Boolean(me?.is_superuser)
        const data = await apiJson<DashboardStats>(`/api/dashboard/stats/${q}`, {
          shopScoped,
        })
        setStats(data)
        setGlobalAdminStats(null)
        if (me?.is_superuser) {
          try {
            const g = await apiJson<AdminGlobalStats>(`/api/admin/stats/${q}`)
            setSuperuserShopRankings(g)
          } catch {
            setSuperuserShopRankings(null)
          }
        } else {
          setSuperuserShopRankings(null)
        }
      }
    } catch (e) {
      setStats(null)
      setGlobalAdminStats(null)
      setSuperuserShopRankings(null)
      if (isApiStatus(e, 403)) {
        setStatsForbidden(true)
      }
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoadingStats(false)
    }
  }, [shouldFetchStats, statsForbidden, me?.is_superuser, dFrom, dTo, t])

  const fetchTopSellingProducts = useCallback(async () => {
    if (!me || getGlobalView()) return
    if (me.is_superuser && !getPersistedSuperuserShopId()) return
    setLoadingTopSelling(true)
    try {
      const q = `?from=${encodeURIComponent(topSellingFrom)}&to=${encodeURIComponent(topSellingTo)}`
      const data = await apiJson<DashboardStats>(`/api/dashboard/stats/${q}`, {
        shopScoped: true,
      })
      setTopSellingProducts(data.top_selling_products ?? [])
    } catch {
      setTopSellingProducts([])
    } finally {
      setLoadingTopSelling(false)
    }
  }, [me, topSellingFrom, topSellingTo])

  const fetchStockProducts = useCallback(async () => {
    if (!me || getGlobalView()) return
    setLoadingStockProducts(true)
    try {
      const data = await apiJson<Paginated<ProductRow> | ProductRow[]>(
        '/api/products/?page_size=200&exclude_discontinued=1',
      )
      const items = Array.isArray(data) ? data : data.results ?? []
      const sorted = [...items]
        .sort((a, b) => Number(b.current_stock_quantity ?? 0) - Number(a.current_stock_quantity ?? 0))
      setStockProducts(sorted.slice(0, 20))
    } catch {
      setStockProducts([])
    } finally {
      setLoadingStockProducts(false)
    }
  }, [me])
  const fetchShopSettings = useCallback(async () => {
    if (!me || getGlobalView()) return
    try {
      const settings = await apiJson<ShopSettingsRow>('/api/shop-settings/')
      setShopLowStockThreshold(settings.low_stock_threshold)
    } catch {
      setShopLowStockThreshold(5)
    }
  }, [me])

  const fetchOnlineStats = useCallback(async () => {
    if (!me?.online_storefront_enabled) {
      setOnlineStats(null)
      return
    }
    setLoadingOnlineStats(true)
    try {
      const q = `?from=${encodeURIComponent(dFrom)}&to=${encodeURIComponent(dTo)}`
      const data = await fetchMerchantStorefrontOrderStats(q)
      setOnlineStats(data)
    } catch {
      setOnlineStats(null)
    } finally {
      setLoadingOnlineStats(false)
    }
  }, [me?.online_storefront_enabled, dFrom, dTo])

  useEffect(() => {
    if (me && shouldFetchStats && !statsForbidden) void fetchStats()
  }, [me, shouldFetchStats, statsForbidden, fetchStats])

  useEffect(() => {
    if (me?.online_storefront_enabled && shouldFetchStats && !statsForbidden) {
      void fetchOnlineStats()
    }
  }, [me?.online_storefront_enabled, shouldFetchStats, statsForbidden, fetchOnlineStats])

  useEffect(() => {
    if (!canFetchShopDashboardExtras) {
      if (me?.is_superuser) {
        setStockProducts([])
        setTopSellingProducts([])
      }
      return
    }
    void fetchTopSellingProducts()
    void fetchStockProducts()
    void fetchShopSettings()
  }, [
    me,
    canFetchShopDashboardExtras,
    fetchTopSellingProducts,
    fetchStockProducts,
    fetchShopSettings,
  ])

  useEffect(() => {
    const onRefresh = () => {
      syncSuperuserScope()
      if (me && shouldFetchStats && !statsForbidden) void fetchStats()
      if (me?.online_storefront_enabled && shouldFetchStats && !statsForbidden) {
        void fetchOnlineStats()
      }
      const shopScoped =
        me && !getGlobalView() && (!me.is_superuser || Boolean(getPersistedSuperuserShopId()))
      if (shopScoped) {
        void fetchTopSellingProducts()
        void fetchStockProducts()
        void fetchShopSettings()
      }
    }
    window.addEventListener('mm-dashboard-refresh', onRefresh)
    return () => window.removeEventListener('mm-dashboard-refresh', onRefresh)
  }, [
    me,
    shouldFetchStats,
    statsForbidden,
    fetchStats,
    fetchOnlineStats,
    fetchTopSellingProducts,
    fetchStockProducts,
    fetchShopSettings,
    syncSuperuserScope,
  ])

  const quickLinks = useMemo(() => {
    const items = [
      {
        to: '/pos',
        label: t('nav.pos'),
        icon: ScanBarcode,
        perms: ['view_product', 'add_sale'],
      },
      {
        to: '/inventory',
        label: t('nav.inventory'),
        icon: Package,
        perms: ['view_product'],
      },
      {
        to: '/profit',
        label: t('nav.profit'),
        icon: TrendingUp,
        perms: ['view_profitreport'],
      },
      {
        to: '/cashier',
        label: t('nav.cashier'),
        icon: Wallet,
        perms: ['view_cashier', 'view_openingcash', 'view_shopdayopeningcash'],
      },
      { to: '/debts', label: t('nav.debts'), icon: Users, perms: ['view_employeedebt'] },
    ] as const
    const visible = items.filter((item) => !('perms' in item) || hasPerm(me, ...item.perms))
    if (me?.online_storefront_enabled) {
      return [
        ...visible,
        { to: '/online-pricing', label: t('nav.onlinePricing'), icon: DollarSign },
        { to: '/online-shop', label: t('nav.onlineShop'), icon: Globe },
      ]
    }
    return visible
  }, [me, t])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  const adminFinancialBarData = useMemo(() => {
    if (!globalAdminStats) return [] as Array<{ name: string; value: number; color: string }>
    const sales = parseFloat(globalAdminStats.global_sales_usd ?? '0') || 0
    const expenses = parseFloat(globalAdminStats.global_expenses_usd ?? '0') || 0
    const pettyCash = (globalAdminStats.top_shops ?? []).reduce(
      (acc, shop) => acc + (parseFloat(shop.period_cash_drawer_usd ?? '0') || 0),
      0,
    )
    const discounts = parseFloat(globalAdminStats.global_discounts_usd) || 0
    return [
      { name: t('dash.totalSold'), value: Math.max(sales, 0), color: '#10b981' },
      { name: t('dash.cashVsExpenses'), value: pettyCash, color: '#6366f1' },
      { name: t('dash.totalExpenses'), value: Math.max(expenses, 0), color: '#f59e0b' },
      { name: t('dash.totalDiscounts'), value: Math.max(discounts, 0), color: '#f43f5e' },
    ]
  }, [globalAdminStats, t])
  const mapTopShopsToRows = useCallback(
    (shops: NonNullable<AdminGlobalStats['top_shops']>) => {
      const rows = shops.map((shop, idx) => {
        const sales = parseFloat(shop.sales_usd) || 0
        const profit = parseFloat(shop.profit_usd) || 0
        const stock = parseFloat(shop.stock_value_usd) || 0
        return {
          shop_id: shop.shop_id,
          name: shop.shop_name,
          is_active: shop.is_active,
          sales,
          totalSold: parseFloat(shop.total_sold_usd ?? shop.sales_usd) || 0,
          profit,
          stock,
          expenses: parseFloat(shop.expenses_usd) || 0,
          receivables: parseFloat(shop.period_receivables_usd ?? '0') || 0,
          returned: parseFloat(shop.returned_products_usd ?? '0') || 0,
          discounts: parseFloat(shop.discounts_usd) || 0,
          pettyCash: parseFloat(shop.period_cash_drawer_usd ?? '0') || 0,
          color: PRODUCT_DONUT_COLORS[idx % PRODUCT_DONUT_COLORS.length],
        }
      })
      const total = rows.reduce((acc, r) => acc + Math.max(r.sales, 0), 0)
      return { rows, total }
    },
    [],
  )

  const topShopsData = useMemo(() => {
    if (!globalAdminStats?.top_shops) return { rows: [], total: 0 }
    return mapTopShopsToRows(globalAdminStats.top_shops)
  }, [globalAdminStats, mapTopShopsToRows])

  const scopedTopShopsPanelRows = useMemo(() => {
    if (!superuserShopRankings?.top_shops?.length) return { rows: [], total: 0 }
    return mapTopShopsToRows(superuserShopRankings.top_shops)
  }, [superuserShopRankings, mapTopShopsToRows])

  const topShopsDonutData = useMemo(() => {
    return {
      rows: topShopsData.rows
        .filter((r) => r.sales > 0)
        .slice(0, 6)
        .map((r) => ({ name: r.name, value: r.sales, color: r.color })),
      total: topShopsData.total,
    }
  }, [topShopsData])
  const cashVsExpensesDelta = useMemo(() => {
    if (!stats) return { value: '0', positive: true }
    const cashAfterExpenses = parseFloat(stats.period_cash_drawer_usd ?? '0')
    if (!Number.isFinite(cashAfterExpenses)) {
      return { value: stats.period_cash_drawer_usd ?? '0', positive: true }
    }
    // period_cash_drawer_usd already includes expenses from backend snapshot:
    // current_cash = opening + sales_in - expenses - debt_effect
    // Avoid subtracting expenses a second time here.
    return { value: cashAfterExpenses.toFixed(4), positive: cashAfterExpenses >= 0 }
  }, [stats])

  const isEmployeeDashboard = Boolean(me && !me.is_superuser && me.role !== 'owner')
  const isSuperuserDashboard = Boolean(me?.is_superuser)
  const chartTopSellingProducts = useMemo((): TopSellingProductRow[] => {
    if (topSellingProducts.length > 0) return topSellingProducts
    if (stats?.top_selling_products?.length) return stats.top_selling_products
    return topSellingProducts
  }, [topSellingProducts, stats?.top_selling_products])
  const filteredTopSellingProducts = useMemo(() => {
    const q = topSellingSearch.trim().toLowerCase()
    const bySearch = q
      ? chartTopSellingProducts.filter((item) => item.product_name.toLowerCase().includes(q))
      : chartTopSellingProducts
    if (topSellingLimit === 'all') return bySearch
    return bySearch.slice(0, Number(topSellingLimit))
  }, [chartTopSellingProducts, topSellingSearch, topSellingLimit])
  const displayedStockProducts = useMemo(() => {
    if (!showOnlyLowStock) return stockProducts
    return stockProducts.filter((item) => {
      const qty = Number(item.current_stock_quantity ?? 0)
      const threshold = item.low_stock_threshold ?? shopLowStockThreshold
      const effectiveThreshold = Math.max(0, Number(threshold ?? 0))
      return qty <= effectiveThreshold || qty <= 0
    })
  }, [stockProducts, showOnlyLowStock, shopLowStockThreshold])
  const topProductsData = useMemo(() => {
    return filteredTopSellingProducts.map((item) => ({
      name: item.product_name,
      qty: item.total_qty,
      sales: parseFloat(item.total_sales_usd),
    }))
  }, [filteredTopSellingProducts])
  const productDonutData = useMemo(() => {
    const source = chartTopSellingProducts.slice(0, 6)
    const rows = source
      .map((item, idx) => {
        const sales = parseFloat(item.total_sales_usd)
        const value = Number.isFinite(sales) && sales > 0 ? sales : Number(item.total_qty) || 0
        return {
          name: item.product_name,
          value,
          color: PRODUCT_DONUT_COLORS[idx % PRODUCT_DONUT_COLORS.length],
        }
      })
      .filter((r) => r.value > 0)
    const total = rows.reduce((acc, r) => acc + r.value, 0)
    return { rows, total }
  }, [chartTopSellingProducts])
  const financialBarData = useMemo(() => {
    if (!stats) return [] as Array<{ name: string; value: number; color: string }>
    const sales = parseFloat(stats.total_sales_usd) || 0
    const expenses = parseFloat(stats.total_expenses_usd) || 0
    const pettyCash = parseFloat(stats.period_cash_drawer_usd ?? '0') || 0
    const discounts = parseFloat(stats.total_discounts_usd ?? '0') || 0
    return [
      { name: t('dash.totalSold'), value: Math.max(sales, 0), color: '#10b981' },
      { name: t('dash.cashVsExpenses'), value: pettyCash, color: '#6366f1' },
      { name: t('dash.totalExpenses'), value: Math.max(expenses, 0), color: '#f59e0b' },
      { name: t('dash.totalDiscounts'), value: Math.max(discounts, 0), color: '#f43f5e' },
    ]
  }, [stats, t])
  const periodCashFlowMetrics = useMemo(() => {
    if (!stats) return null
    const cashIn = Math.max(parseFloat(stats.period_cash_in_usd ?? '0') || 0, 0)
    const cashOut = Math.max(parseFloat(stats.period_cash_out_usd ?? '0') || 0, 0)
    const net = parseFloat(stats.period_cash_drawer_usd ?? '0') || 0
    return { cashIn, cashOut, net }
  }, [stats])

  const adminPettyCashByShopData = useMemo(() => {
    if (!globalAdminStats?.top_shops?.length) {
      return [] as Array<{ name: string; value: number; color: string }>
    }
    return [...globalAdminStats.top_shops]
      .map((shop, idx) => ({
        name:
          shop.shop_name.length > 14
            ? `${shop.shop_name.slice(0, 13)}â€¦`
            : shop.shop_name,
        value: parseFloat(shop.period_cash_drawer_usd ?? '0') || 0,
        color: PRODUCT_DONUT_COLORS[idx % PRODUCT_DONUT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [globalAdminStats])
  const returnsRatio = useMemo(() => {
    if (!stats) return { pct: 0, returned: 0, sales: 0 }
    const sales = parseFloat(stats.total_sales_usd) || 0
    const returned = parseFloat(stats.total_returned_products_usd ?? '0') || 0
    const pct = sales > 0 ? Math.min(100, Math.round((returned / sales) * 100)) : 0
    return { pct, returned, sales }
  }, [stats])
  /** Stock remaining + returns ratio, side by side (used above shops / compact rank). */
  const dashStockReturnsTwoColRow = useMemo(
    () => (
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Package className="h-4 w-4" />
              </span>
              {t('dash.stockItemsRemaining')}
            </h2>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showOnlyLowStock}
                onChange={(e) => setShowOnlyLowStock(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 dark:border-slate-600 dark:bg-slate-900"
              />
              <span>{t('dash.showOnlyLowStock')}</span>
            </label>
          </div>
          {loadingStockProducts ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
          ) : displayedStockProducts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.noData')}</p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                <span>{t('jard.product')}</span>
                <span className="text-end">{t('jard.remainingQty')}</span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {displayedStockProducts.map((item) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <span className="truncate text-slate-800 dark:text-slate-100">{item.name}</span>
                    <span className="inline-flex w-fit items-center justify-self-end rounded-full bg-emerald-50 px-2.5 py-1 text-end text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {formatCompactNumber(item.current_stock_quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                <RotateCcw className="h-4 w-4" />
              </span>
              {t('dash.totalReturnedProducts')}
            </h2>
          </div>
          <ReturnsRatioPanel
            pct={returnsRatio.pct}
            returned={returnsRatio.returned}
            sales={returnsRatio.sales}
            currencyLabel={t('common.currencyUsd')}
            labelReturns={t('dash.totalReturnedProducts')}
            labelSales={t('dash.totalSold')}
          />
        </section>
      </div>
    ),
    [
      t,
      showOnlyLowStock,
      loadingStockProducts,
      displayedStockProducts,
      returnsRatio.pct,
      returnsRatio.returned,
      returnsRatio.sales,
    ],
  )
  const topSellingNameSuggestions = useMemo(() => {
    const names = Array.from(
      new Set(
        chartTopSellingProducts
          .map((item) => String(item.product_name || '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b))
    const q = topSellingSearch.trim().toLowerCase()
    return names.filter((name) => (!q ? true : name.toLowerCase().includes(q))).slice(0, 20)
  }, [chartTopSellingProducts, topSellingSearch])
  const topMaxQty = useMemo(() => {
    if (topProductsData.length === 0) return 1
    return Math.max(...topProductsData.map((row) => row.qty), 1)
  }, [topProductsData])
  const resolvePresetRange = useCallback((preset: 'today' | 'week' | 'month' | 'year') => {
    const now = new Date()
    const end = formatDateInputValue(now)
    let startDate = new Date(now)
    if (preset === 'week') {
      const day = now.getDay()
      const diffToMonday = (day + 6) % 7
      startDate.setDate(now.getDate() - diffToMonday)
    } else if (preset === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (preset === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    }
    const start = formatDateInputValue(startDate)
    return { start, end }
  }, [])
  const applyDatePreset = useCallback(
    (preset: 'today' | 'week' | 'month' | 'year') => {
      preserveScrollPosition()
      const { start, end } = resolvePresetRange(preset)
      setDFrom(start)
      setDTo(end)
    },
    [preserveScrollPosition, resolvePresetRange],
  )
  const applyTopSellingDatePreset = useCallback(
    (preset: 'today' | 'week' | 'month' | 'year') => {
      preserveScrollPosition()
      const { start, end } = resolvePresetRange(preset)
      setTopSellingFrom(start)
      setTopSellingTo(end)
    },
    [preserveScrollPosition, resolvePresetRange],
  )

  const onlineStorefrontDashboardSection = useMemo(() => {
    if (!me?.online_storefront_enabled) return null
    return (
      <section className="mb-6 mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('nav.onlineSection')}
            </h2>
            <p className="mt-0.5 text-start text-xs text-slate-500 dark:text-slate-400">
              {t('dash.onlineStatsHint')}
            </p>
          </div>
          {loadingOnlineStats ? (
            <span className="text-xs text-slate-500">{t('common.loading')}</span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label={t('dash.onlineTotalSales')}
            value={onlineStats?.total_sales_usd ?? '0'}
            tone="emerald"
            currencyLabel={t('common.currencyUsd')}
          />
          <StatCard
            icon={<ShoppingCart className="h-5 w-5" />}
            label={t('dash.onlineOrderCount')}
            value={String(onlineStats?.order_count ?? 0)}
            tone="violet"
            unit="count"
            currencyLabel=""
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label={t('dash.onlinePendingOrders')}
            value={String(onlineStats?.pending_count ?? 0)}
            tone="amber"
            unit="count"
            currencyLabel=""
          />
          <StatCard
            icon={<Package className="h-5 w-5" />}
            label={t('dash.onlineProcessingOrders')}
            value={String(onlineStats?.processing_count ?? 0)}
            tone="violet"
            unit="count"
            currencyLabel=""
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label={t('dash.onlineCompletedOrders')}
            value={String(onlineStats?.completed_count ?? 0)}
            tone="emerald"
            unit="count"
            currencyLabel=""
          />
          <StatCard
            icon={<TrendingDown className="h-5 w-5" />}
            label={t('dash.onlineCancelledOrders')}
            value={String(onlineStats?.cancelled_count ?? 0)}
            tone="rose"
            unit="count"
            currencyLabel=""
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/online-orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden />
            {t('nav.onlineOrders')}
          </Link>
          <Link
            to="/online-shop"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <Globe className="h-4 w-4" aria-hidden />
            {t('nav.onlineShop')}
          </Link>
          <Link
            to="/online-pricing"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            <DollarSign className="h-4 w-4" aria-hidden />
            {t('dash.onlinePricingCard')}
          </Link>
        </div>
      </section>
    )
  }, [me?.online_storefront_enabled, onlineStats, loadingOnlineStats, t])

  if (!me) {
    return (
      <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img
                src="/brand-logo.png"
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-contain"
              />
              <span className="font-semibold text-slate-900 dark:text-white">{t('dash.signIn')}</span>
            </div>
            <LangSwitcher lang={lang} setLang={setLang} t={t} />
          </div>
        </div>
        <main className="mx-auto max-w-lg px-4 py-12">
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder={t('pos.emailPlaceholder')}
              autoComplete="email"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder={t('pos.passwordPlaceholder')}
              autoComplete="current-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-600 py-2.5 font-medium text-white"
            >
              {t('dash.signIn')}
            </button>
          </form>
        </main>
      </div>
    )
  }

  if (!shouldFetchStats) {
    return (
      <div className="min-h-dvh bg-slate-50 px-4 py-8 dark:bg-slate-900">
        <h1 className="mx-auto mb-8 max-w-3xl text-lg font-semibold text-slate-900 dark:text-white">
          {t('dash.welcome')}
        </h1>
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
          {quickLinks.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-violet-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <Icon className="h-10 w-10 text-violet-600" />
                <span className="font-semibold text-center">{item.label}</span>
              </Link>
            )
          })}
          {quickLinks.length > 0 ? (
            <p className="sm:col-span-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('dash.employeeHint')}
            </p>
          ) : (
            <p className="sm:col-span-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('dash.noPermissionsHint')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t('nav.dashboard')}
            </h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{t('dash.welcome')}</span>
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
              <span className="font-medium text-violet-600 dark:text-violet-300">
                {t('nav.dashboard')}
              </span>
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="block">
              <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dash.from')}</span>
              <input
                type="date"
                value={dFrom}
                    onChange={(e) => {
                      preserveScrollPosition()
                      setDFrom(e.target.value)
                    }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dash.to')}</span>
              <input
                type="date"
                value={dTo}
                    onChange={(e) => {
                      preserveScrollPosition()
                      setDTo(e.target.value)
                    }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  preserveScrollPosition()
                  void fetchStats()
                }}
                disabled={loadingStats}
                className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                {loadingStats ? t('common.loading') : t('dash.apply')}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyDatePreset('today')}
              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-900/30 dark:text-violet-200 dark:hover:bg-violet-900/50"
            >
              {t('dash.today')}
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('week')}
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
            >
              {t('dash.thisWeek')}
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('month')}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
            >
              {t('dash.thisMonth')}
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset('year')}
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
            >
              {t('dash.thisYear')}
            </button>
          </div>
        </section>

        {me?.is_superuser && globalAdminStats ? (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
              {t('dash.onlineShopsManage')}
            </h2>
            <p className="mt-1 text-start text-xs text-slate-500 dark:text-slate-400">
              {t('admin.globalReportsDesc')}
            </p>
            <Link
              to="/system/shops"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              <Store className="h-4 w-4" aria-hidden />
              {t('admin.shops')}
            </Link>
          </section>
        ) : null}

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {globalAdminStats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard
                icon={<LayoutDashboard className="h-5 w-5" />}
                label={t('admin.totalShops')}
                value={String(globalAdminStats.total_shops)}
                tone="slate"
                unit="count"
                currencyLabel={t('common.currencyUsd')}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                label={t('admin.active')}
                value={String(globalAdminStats.total_active_shops)}
                tone="emerald"
                unit="count"
                currencyLabel={t('common.currencyUsd')}
              />
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                label={t('admin.activeUsers')}
                value={String(globalAdminStats.total_active_users)}
                tone="violet"
                unit="count"
                currencyLabel={t('common.currencyUsd')}
              />
              <StatCard
                icon={<Banknote className="h-5 w-5" />}
                label={t('admin.globalProfit')}
                value={globalAdminStats.global_profit_usd}
                tone="emerald"
                currencyLabel={t('common.currencyUsd')}
              />
              <StatCard
                icon={<Package className="h-5 w-5" />}
                label={t('admin.globalStockValue')}
                value={globalAdminStats.global_stock_value_usd}
                tone="slate"
                currencyLabel={t('common.currencyUsd')}
              />
              <StatCard
                icon={<Banknote className="h-5 w-5" />}
                label={t('dash.totalDiscounts')}
                value={globalAdminStats.global_discounts_usd}
                tone="rose"
                currencyLabel={t('common.currencyUsd')}
              />
            </div>
            {onlineStorefrontDashboardSection}
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    {t('dash.financialOverview')}
                  </h2>
                </div>
                <FinancialBarPanel
                  data={adminFinancialBarData}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('common.noData')}
                />
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <PieChartIcon className="h-4 w-4" />
                    </span>
                    {t('admin.topSellingShops')}
                  </h2>
                </div>
                <DonutPanel
                  data={topShopsDonutData.rows}
                  total={topShopsDonutData.total}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('admin.topShopsEmpty')}
                />
              </section>
              <section className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/40 to-fuchsia-50/30 p-5 shadow-sm ring-1 ring-violet-100/80 dark:border-violet-500/25 dark:from-slate-800 dark:via-violet-950/25 dark:to-slate-800 dark:ring-violet-500/15">
                <div className="pointer-events-none absolute -end-8 -top-8 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl dark:bg-violet-500/10" />
                <div className="relative mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30">
                      <Store className="h-4 w-4" />
                    </span>
                    {t('admin.pettyCashByShop')}
                  </h2>
                </div>
                <PettyCashByShopPanel
                  data={adminPettyCashByShopData}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('common.noData')}
                />
              </section>
            </div>

            <section className="mt-4 rounded-3xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/50 to-fuchsia-50/40 p-6 shadow-sm dark:border-violet-500/30 dark:bg-gradient-to-br dark:from-slate-800 dark:via-violet-950/20 dark:to-slate-800">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                    <Store className="h-4 w-4" />
                  </span>
                  {t('admin.topSellingShops')}
                </h2>
                <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-400/40 dark:bg-violet-900/50 dark:text-violet-100">
                  {topShopsData.rows.length}
                </span>
              </div>
              <TopShopsListPanel
                rows={topShopsData.rows}
                currencyLabel={t('common.currencyUsd')}
                emptyLabel={t('admin.topShopsEmpty')}
                activeLabel={t('admin.shopActive')}
                inactiveLabel={t('admin.shopInactive')}
                profitLabel={t('admin.shopProfit')}
                salesLabel={t('admin.shopSales')}
                stockLabel={t('dash.stockValue')}
                chartCaption={t('admin.shopsSalesCompareChart')}
                totalSoldLabel={t('dash.totalSold')}
                expensesLabel={t('dash.totalExpenses')}
                receivablesLabel={t('dash.totalDebtorCustomers')}
                returnedLabel={t('dash.totalReturnedProducts')}
                discountsLabel={t('dash.totalDiscounts')}
                pettyCashLabel={t('dash.cashVsExpenses')}
              />
            </section>
          </>
        )}

        {stats && !globalAdminStats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {isEmployeeDashboard || isSuperuserDashboard ? (
                <>
                  <StatCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label={t('dash.totalSold')}
                    value={stats.total_sales_usd}
                    tone="emerald"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Wallet className="h-5 w-5" />}
                    label={t('dash.totalExpenses')}
                    value={stats.total_expenses_usd}
                    tone="amber"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Users className="h-5 w-5" />}
                    label={t('dash.totalDebtorCustomers')}
                    value={stats.period_receivables_usd ?? '0'}
                    tone="violet"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Package className="h-5 w-5" />}
                    label={t('dash.totalReturnedProducts')}
                    value={stats.total_returned_products_usd ?? '0'}
                    tone="rose"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Banknote className="h-5 w-5" />}
                    label={t('dash.totalDiscounts')}
                    value={stats.total_discounts_usd ?? '0'}
                    tone="rose"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Banknote className="h-5 w-5" />}
                    label={t('dash.cashVsExpenses')}
                    value={cashVsExpensesDelta.value}
                    tone={cashVsExpensesDelta.positive ? 'emerald' : 'rose'}
                    currencyLabel={t('common.currencyUsd')}
                  />
                </>
              ) : (
                <>
                  <StatCard
                    icon={<Wallet className="h-5 w-5" />}
                    label={t('dash.expenses')}
                    value={stats.total_expenses_usd}
                    tone="amber"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Banknote className="h-5 w-5" />}
                    label={t('dash.receivables')}
                    value={stats.total_receivables_usd}
                    tone="violet"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Banknote className="h-5 w-5" />}
                    label={t('dash.payables')}
                    value={stats.total_payables_usd}
                    tone="rose"
                    currencyLabel={t('common.currencyUsd')}
                  />
                  <StatCard
                    icon={<Package className="h-5 w-5" />}
                    label={t('dash.stockValue')}
                    value={stats.total_stock_value_usd}
                    tone="slate"
                    currencyLabel={t('common.currencyUsd')}
                  />
                </>
              )}
            </div>
            {onlineStorefrontDashboardSection}
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    {t('dash.financialOverview')}
                  </h2>
                </div>
                <FinancialBarPanel
                  data={financialBarData}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('common.noData')}
                />
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <PieChartIcon className="h-4 w-4" />
                    </span>
                    {t('dash.topProductsSalesShare')}
                  </h2>
                </div>
                <DonutPanel
                  data={productDonutData.rows}
                  total={productDonutData.total}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('dash.topSellingEmpty')}
                />
              </section>
              <section className="relative overflow-hidden rounded-2xl border border-cyan-200/70 bg-gradient-to-br from-white via-cyan-50/50 to-teal-50/30 p-5 shadow-sm ring-1 ring-cyan-100/80 dark:border-cyan-500/25 dark:from-slate-800 dark:via-cyan-950/30 dark:to-slate-800 dark:ring-cyan-500/15">
                <div className="pointer-events-none absolute -start-6 -top-6 h-24 w-24 rounded-full bg-cyan-300/25 blur-2xl dark:bg-cyan-500/10" />
                <div className="pointer-events-none absolute -bottom-8 -end-6 h-20 w-20 rounded-full bg-teal-300/20 blur-2xl dark:bg-teal-500/10" />
                <div className="relative mb-1 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/35">
                      <Activity className="h-4 w-4" />
                    </span>
                    {t('dash.periodCashFlow')}
                  </h2>
                </div>
                <p className="relative mb-4 text-start text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {t('dash.periodCashFlowHint')}
                </p>
                <PeriodCashFlowPanel
                  cashIn={periodCashFlowMetrics?.cashIn ?? 0}
                  cashOut={periodCashFlowMetrics?.cashOut ?? 0}
                  net={periodCashFlowMetrics?.net ?? 0}
                  currencyLabel={t('common.currencyUsd')}
                  emptyLabel={t('common.noData')}
                  labelIn={t('dash.cashInPeriod')}
                  labelOut={t('dash.cashOutPeriod')}
                  labelNet={t('dash.periodCashNet')}
                />
              </section>
            </div>

            <>
              {dashStockReturnsTwoColRow}
              {me?.is_superuser ? (
                <section className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-violet-200/70 dark:border-slate-700 dark:bg-slate-800 dark:ring-violet-500/20">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                        <Store className="h-4 w-4" />
                      </span>
                      {t('admin.topSellingShops')}
                    </h2>
                  </div>
                  <TopShopsListPanel
                    rows={scopedTopShopsPanelRows.rows}
                    currencyLabel={t('common.currencyUsd')}
                    emptyLabel={t('admin.topShopsEmpty')}
                    activeLabel={t('admin.shopActive')}
                    inactiveLabel={t('admin.shopInactive')}
                    profitLabel={t('admin.shopProfit')}
                    salesLabel={t('admin.shopSales')}
                    stockLabel={t('dash.stockValue')}
                    chartCaption={t('admin.shopsSalesCompareChart')}
                    totalSoldLabel={t('dash.totalSold')}
                    expensesLabel={t('dash.totalExpenses')}
                    receivablesLabel={t('dash.totalDebtorCustomers')}
                    returnedLabel={t('dash.totalReturnedProducts')}
                    discountsLabel={t('dash.totalDiscounts')}
                    pettyCashLabel={t('dash.cashVsExpenses')}
                  />
                </section>
              ) : (
                <section className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                        <TrendingUp className="h-4 w-4" />
                      </span>
                      {t('dash.topSellingRankBrief')}
                    </h2>
                  </div>
                  <CompactTopSellersPanel
                    rows={productDonutData.rows.slice(0, 6).map((r) => ({
                      name: r.name,
                      value: r.value,
                      color: r.color,
                    }))}
                    emptyLabel={t('dash.topSellingEmpty')}
                    currencyLabel={t('common.currencyUsd')}
                  />
                </section>
              )}
            </>
            <section className="mt-8 rounded-3xl border border-violet-200/70 bg-gradient-to-br from-white via-violet-50/50 to-fuchsia-50/40 p-6 shadow-sm dark:border-violet-500/30 dark:bg-gradient-to-br dark:from-slate-800 dark:via-violet-950/20 dark:to-slate-800">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-start text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  {t('dash.topSellingProducts')}
                </h2>
                <span className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 dark:border-violet-400/40 dark:bg-violet-900/50 dark:text-violet-100">
                  {filteredTopSellingProducts.length}/{chartTopSellingProducts.length}
                </span>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block">
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dash.from')}</span>
                  <input
                    type="date"
                    value={topSellingFrom}
                    onChange={(e) => {
                      preserveScrollPosition()
                      setTopSellingFrom(e.target.value)
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dash.to')}</span>
                  <input
                    type="date"
                    value={topSellingTo}
                    onChange={(e) => {
                      preserveScrollPosition()
                      setTopSellingTo(e.target.value)
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      preserveScrollPosition()
                      void fetchTopSellingProducts()
                    }}
                    disabled={loadingTopSelling}
                    className="min-h-11 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400 disabled:opacity-60"
                  >
                    {loadingTopSelling ? t('common.loading') : t('dash.apply')}
                  </button>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyTopSellingDatePreset('today')}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/40 dark:bg-violet-900/30 dark:text-violet-200 dark:hover:bg-violet-900/50"
                >
                  {t('dash.today')}
                </button>
                <button
                  type="button"
                  onClick={() => applyTopSellingDatePreset('week')}
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
                >
                  {t('dash.thisWeek')}
                </button>
                <button
                  type="button"
                  onClick={() => applyTopSellingDatePreset('month')}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                >
                  {t('dash.thisMonth')}
                </button>
                <button
                  type="button"
                  onClick={() => applyTopSellingDatePreset('year')}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                >
                  {t('dash.thisYear')}
                </button>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="relative block">
                  <span className="block text-xs text-slate-600 dark:text-slate-300">
                    {t('dash.search')}
                  </span>
                  <input
                    type="search"
                    value={topSellingSearch}
                    onChange={(e) => {
                      setTopSellingSearch(e.target.value)
                      setTopSellingSearchOpen(true)
                    }}
                    onFocus={() => setTopSellingSearchOpen(true)}
                    onBlur={() => window.setTimeout(() => setTopSellingSearchOpen(false), 120)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder={t('dash.search')}
                  />
                  {topSellingSearchOpen && topSellingNameSuggestions.length > 0 ? (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                      {topSellingNameSuggestions.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => {
                              setTopSellingSearch(name)
                              setTopSellingSearchOpen(false)
                            }}
                            className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-600 dark:text-slate-300">{t('dash.show')}</span>
                  <select
                    value={topSellingLimit}
                    onChange={(e) => setTopSellingLimit(e.target.value as '10' | '20' | '50' | 'all')}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="all">{t('common.all')}</option>
                  </select>
                </label>
              </div>
              {loadingTopSelling ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
              ) : topProductsData.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('dash.topSellingEmpty')}</p>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="grid grid-cols-[56px_minmax(0,1fr)_120px] items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                      <span>#</span>
                      <span>{t('jard.product')}</span>
                      <span className="text-end">{t('dash.unitsSold')}</span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700/90">
                      {filteredTopSellingProducts.map((item, idx) => (
                        <li
                          key={`${item.product_id ?? 'manual'}-${idx}`}
                          className="grid grid-cols-[56px_minmax(0,1fr)_120px] items-center gap-2 px-3 py-2.5 hover:bg-slate-50/70 dark:hover:bg-violet-900/20"
                        >
                          <span className="inline-flex w-fit items-center justify-center rounded-full bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-100">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {item.product_name}
                            </p>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700/80">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 dark:from-violet-400 dark:to-fuchsia-400"
                                style={{
                                  width: `${Math.max(
                                    8,
                                    Math.round((item.total_qty / topMaxQty) * 100),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-end">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {formatCompactNumber(item.total_qty)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>

      {showSuperuserScopeCard ? (
        <SuperuserDashboardScopeCard
          t={t}
          shops={scopeShops}
          shopId={scopeShopId}
          onShopIdChange={setScopeShopId}
          onApplyShop={applySuperuserScopeShop}
          onEnableGlobalView={enableSuperuserScopeGlobalView}
        />
      ) : null}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
  unit = 'usd',
  currencyLabel,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'emerald' | 'amber' | 'violet' | 'rose' | 'slate'
  unit?: 'usd' | 'count'
  currencyLabel: string
}) {
  const ring =
    tone === 'emerald'
      ? 'border-emerald-300 bg-emerald-100/85 dark:border-emerald-500/40 dark:bg-emerald-900/25'
      : tone === 'amber'
        ? 'border-amber-300 bg-amber-100/85 dark:border-amber-500/40 dark:bg-amber-900/25'
        : tone === 'violet'
          ? 'border-violet-300 bg-violet-100/85 dark:border-violet-500/40 dark:bg-violet-900/25'
          : tone === 'rose'
            ? 'border-rose-300 bg-rose-100/85 dark:border-rose-500/40 dark:bg-rose-900/25'
            : 'border-slate-300 bg-slate-100/90 dark:border-slate-600 dark:bg-slate-800/70'
  return (
    <div
      className={`flex min-h-0 flex-col gap-2 rounded-2xl border p-4 shadow-sm ${ring}`}
    >
      <div className="flex min-w-0 items-start gap-2 text-slate-700 dark:text-slate-300">
        {icon}
        <span className="min-w-0 break-words text-xs font-medium leading-snug">{label}</span>
      </div>
      <p className="break-words text-start text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
        {formatCompactNumber(value)}
      </p>
      {unit === 'usd' ? (
        <span className="text-xs text-slate-600 dark:text-slate-400">{currencyLabel}</span>
      ) : (
        <span className="text-xs text-slate-600 dark:text-slate-400">&nbsp;</span>
      )}
    </div>
  )
}

function DonutPanel({
  data,
  total,
  currencyLabel,
  emptyLabel,
}: {
  data: Array<{ name: string; value: number; color: string }>
  total?: number
  currencyLabel: string
  emptyLabel: string
}) {
  const computedTotal = total ?? data.reduce((acc, r) => acc + r.value, 0)
  if (data.length === 0 || computedTotal <= 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative h-56 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
                fontSize: '12px',
              }}
              formatter={(v) =>
                typeof v === 'number'
                  ? `${formatCompactNumber(v)} ${currencyLabel}`
                  : String(v ?? '')
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, idx) => (
                <Cell key={`donut-${idx}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-slate-500 dark:text-slate-400">{currencyLabel}</span>
          <span className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCompactNumber(computedTotal)}
          </span>
        </div>
      </div>
      <ul className="space-y-2">
        {data.map((entry, idx) => {
          const pct = computedTotal > 0 ? Math.round((entry.value / computedTotal) * 100) : 0
          return (
            <li
              key={`legend-${idx}-${entry.name}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
                <span className="truncate text-slate-700 dark:text-slate-200" title={entry.name}>
                  {entry.name}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                {pct}%
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function PeriodCashFlowPanel({
  cashIn,
  cashOut,
  net,
  currencyLabel,
  emptyLabel,
  labelIn,
  labelOut,
  labelNet,
}: {
  cashIn: number
  cashOut: number
  net: number
  currencyLabel: string
  emptyLabel: string
  labelIn: string
  labelOut: string
  labelNet: string
}) {
  const flowTotal = cashIn + cashOut
  if (flowTotal === 0 && net === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-cyan-200/80 bg-white/60 text-sm text-slate-500 backdrop-blur-sm dark:border-cyan-500/30 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    )
  }
  const inShare = flowTotal > 0 ? (cashIn / flowTotal) * 100 : 50
  const outShare = flowTotal > 0 ? (cashOut / flowTotal) * 100 : 50
  const netPositive = net >= 0

  return (
    <div className="relative space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-teal-50/90 p-4 shadow-sm transition hover:shadow-md dark:border-emerald-500/30 dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-teal-950/30">
          <div className="pointer-events-none absolute -end-4 -top-4 h-16 w-16 rounded-full bg-emerald-300/30 blur-xl dark:bg-emerald-500/15" />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {labelIn}
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-emerald-900 dark:text-emerald-100">
                {formatCompactNumber(cashIn)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                {currencyLabel}
              </p>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300">
              <TrendingUp className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-orange-50/90 p-4 shadow-sm transition hover:shadow-md dark:border-rose-500/30 dark:from-rose-950/40 dark:via-slate-900/50 dark:to-orange-950/30">
          <div className="pointer-events-none absolute -end-4 -top-4 h-16 w-16 rounded-full bg-rose-300/30 blur-xl dark:bg-rose-500/15" />
          <div className="relative flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                {labelOut}
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-rose-900 dark:text-rose-100">
                {formatCompactNumber(cashOut)}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-rose-600/80 dark:text-rose-400/80">
                {currencyLabel}
              </p>
            </div>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300">
              <TrendingDown className="h-4 w-4" aria-hidden />
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-inner backdrop-blur-sm dark:border-slate-600/50 dark:bg-slate-900/50">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400">{labelIn}</span>
          <span className="text-rose-600 dark:text-rose-400">{labelOut}</span>
        </div>
        <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${Math.max(inShare, cashIn > 0 ? 8 : 0)}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-rose-400 via-rose-500 to-orange-500 transition-all duration-500"
            style={{ width: `${Math.max(outShare, cashOut > 0 ? 8 : 0)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-slate-600 dark:text-slate-400">
          <span>{Math.round(inShare)}%</span>
          <span>{Math.round(outShare)}%</span>
        </div>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border px-4 py-3.5 text-center shadow-sm ${
          netPositive
            ? 'border-emerald-200/90 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-cyan-50/60 dark:border-emerald-500/35 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-cyan-950/20'
            : 'border-rose-200/90 bg-gradient-to-r from-rose-50 via-orange-50/80 to-amber-50/60 dark:border-rose-500/35 dark:from-rose-950/50 dark:via-orange-950/30 dark:to-amber-950/20'
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {labelNet}
        </p>
        <p
          className={`mt-1 text-2xl font-extrabold tabular-nums tracking-tight ${
            netPositive
              ? 'text-emerald-700 dark:text-emerald-200'
              : 'text-rose-700 dark:text-rose-200'
          }`}
        >
          {formatCompactNumber(net)}{' '}
          <span className="text-sm font-semibold opacity-80">{currencyLabel}</span>
        </p>
      </div>
    </div>
  )
}

function PettyCashByShopPanel({
  data,
  currencyLabel,
  emptyLabel,
}: {
  data: Array<{ name: string; value: number; color: string }>
  currencyLabel: string
  emptyLabel: string
}) {
  const max = data.reduce((acc, r) => Math.max(acc, r.value), 0)
  if (data.length === 0 || max <= 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-violet-200/80 bg-white/60 text-sm text-slate-500 backdrop-blur-sm dark:border-violet-500/30 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    )
  }
  return (
    <ul className="relative space-y-2.5">
      {data.map((row, idx) => {
        const widthPct = max > 0 ? Math.max((row.value / max) * 100, 6) : 0
        return (
          <li
            key={`petty-shop-${idx}-${row.name}`}
            className="rounded-xl border border-white/80 bg-white/80 p-2.5 shadow-sm backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/50"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-100 text-[10px] font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                  {idx + 1}
                </span>
                <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100" title={row.name}>
                  {row.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-violet-700 dark:text-violet-200">
                {formatCompactNumber(row.value)} {currencyLabel}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 shadow-sm transition-all duration-500"
                style={{ width: `${widthPct}%`, opacity: 1 - idx * 0.12 }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function FinancialBarPanel({
  data,
  currencyLabel,
  emptyLabel,
}: {
  data: Array<{ name: string; value: number; color: string }>
  currencyLabel: string
  emptyLabel: string
}) {
  const totalAbs = data.reduce((acc, r) => acc + Math.abs(r.value), 0)
  if (data.length === 0 || totalAbs === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="h-56 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} barCategoryGap={20}>
          <CartesianGrid strokeDasharray="3 6" strokeOpacity={0.25} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCompactNumber(v)}
            width={48}
          />
          <Tooltip
            cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
              fontSize: '12px',
            }}
            formatter={(v) =>
              typeof v === 'number' ? `${formatCompactNumber(v)} ${currencyLabel}` : String(v ?? '')
            }
          />
          <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={42}>
            {data.map((entry, idx) => (
              <Cell key={`fin-bar-${idx}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}


function CompactTopSellersPanel({
  rows,
  emptyLabel,
  currencyLabel,
}: {
  rows: Array<{ name: string; value: number; color: string }>
  emptyLabel: string
  currencyLabel: string
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        {emptyLabel}
      </div>
    )
  }
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((row, idx) => {
        const widthPct = Math.max(6, Math.round((row.value / max) * 100))
        return (
          <li key={`compact-top-${idx}-${row.name}`} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ backgroundColor: row.color }}
                >
                  {idx + 1}
                </span>
                <span className="truncate text-slate-700 dark:text-slate-200" title={row.name}>
                  {row.name}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                {formatCompactNumber(row.value)} {currencyLabel}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
              <div
                className="h-full rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: row.color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ReturnsRatioPanel({
  pct,
  returned,
  sales,
  currencyLabel,
  labelReturns,
  labelSales,
}: {
  pct: number
  returned: number
  sales: number
  currencyLabel: string
  labelReturns: string
  labelSales: string
}) {
  const safe = Math.max(0, Math.min(100, pct))
  const data = [{ name: 'returns', value: safe, fill: '#f43f5e' }]
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative h-44 w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: 'rgba(148, 163, 184, 0.18)' }} dataKey="value" cornerRadius={20} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-300">
            {safe}%
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            <Activity className="inline h-3 w-3" />
          </span>
        </div>
      </div>
      <dl className="space-y-2 text-xs">
        <div className="rounded-lg bg-rose-50/70 px-2.5 py-2 dark:bg-rose-500/10">
          <dt className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
            {labelReturns}
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-rose-700 dark:text-rose-200">
            {formatCompactNumber(returned)} {currencyLabel}
          </dd>
        </div>
        <div className="rounded-lg bg-emerald-50/70 px-2.5 py-2 dark:bg-emerald-500/10">
          <dt className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            {labelSales}
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">
            {formatCompactNumber(sales)} {currencyLabel}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function TopShopsSalesBarChart({
  rows,
  currencyLabel,
}: {
  rows: Array<{ shop_id: number; name: string; sales: number; color: string }>
  currencyLabel: string
}) {
  const chartRows = [...rows]
    .sort((a, b) => b.sales - a.sales)
    .map((r) => ({
      shop_id: r.shop_id,
      name: r.name,
      shortName: r.name.length > 16 ? `${r.name.slice(0, 16)}â€¦` : r.name,
      sales: Math.max(r.sales, 0),
      fill: r.color,
    }))
  const chartHeight = Math.min(280, 56 + chartRows.length * 44)
  if (chartRows.length === 0) return null
  return (
    <div
      className="relative isolate min-h-[140px] w-full overflow-hidden rounded-xl bg-white/80 dark:bg-slate-900/40"
      style={{ height: chartHeight }}
      dir="ltr"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartRows}
          layout="vertical"
          margin={{ top: 10, right: 18, left: 6, bottom: 10 }}
          barCategoryGap={14}
        >
          <CartesianGrid strokeDasharray="3 6" strokeOpacity={0.18} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            tickFormatter={(v) => formatCompactNumber(v)}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={112}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(139, 92, 246, 0.06)' }}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e9d5ff',
              fontSize: '12px',
              boxShadow: '0 10px 28px rgba(15, 23, 42, 0.1)',
            }}
            formatter={(value) =>
              `${formatCompactNumber(Number(value))} ${currencyLabel}`
            }
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { name?: string } | undefined)?.name ?? ''
            }
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Bar dataKey="sales" radius={[0, 8, 8, 0]} maxBarSize={20} minPointSize={6}>
            {chartRows.map((entry) => (
              <Cell key={`shop-bar-${entry.shop_id}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

type TopShopRow = {
  shop_id: number
  name: string
  is_active: boolean
  sales: number
  totalSold: number
  profit: number
  stock: number
  expenses: number
  receivables: number
  returned: number
  discounts: number
  pettyCash: number
  color: string
}

function ShopMetricPill({
  icon,
  label,
  value,
  currencyLabel,
  tone = 'slate',
}: {
  icon: React.ReactNode
  label: string
  value: number
  currencyLabel: string
  tone?: 'slate' | 'amber' | 'violet' | 'rose' | 'sky' | 'emerald'
}) {
  const toneClasses = {
    slate: 'border-slate-200/80 bg-slate-50/90 dark:border-slate-600/60 dark:bg-slate-800/50',
    amber: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-700/40 dark:bg-amber-950/25',
    violet: 'border-violet-200/80 bg-violet-50/70 dark:border-violet-700/40 dark:bg-violet-950/25',
    rose: 'border-rose-200/80 bg-rose-50/70 dark:border-rose-700/40 dark:bg-rose-950/25',
    sky: 'border-sky-200/80 bg-sky-50/70 dark:border-sky-700/40 dark:bg-sky-950/25',
    emerald: 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-700/40 dark:bg-emerald-950/25',
  }[tone]

  return (
    <div className={`rounded-xl border px-2.5 py-2 transition-colors ${toneClasses}`}>
      <p className="flex items-center gap-1 text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">
        <span className="shrink-0 opacity-80">{icon}</span>
        <span className="line-clamp-2 min-w-0">{label}</span>
      </p>
      <p className="mt-1 text-start text-sm font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
        {formatCompactNumber(value)}
        <span className="ms-1 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {currencyLabel}
        </span>
      </p>
    </div>
  )
}

function TopShopsListPanel({
  rows,
  currencyLabel,
  emptyLabel,
  activeLabel,
  inactiveLabel,
  profitLabel,
  salesLabel,
  stockLabel,
  chartCaption,
  totalSoldLabel,
  expensesLabel,
  receivablesLabel,
  returnedLabel,
  discountsLabel,
  pettyCashLabel,
}: {
  rows: TopShopRow[]
  currencyLabel: string
  emptyLabel: string
  activeLabel: string
  inactiveLabel: string
  profitLabel: string
  salesLabel: string
  stockLabel: string
  chartCaption: string
  totalSoldLabel: string
  expensesLabel: string
  receivablesLabel: string
  returnedLabel: string
  discountsLabel: string
  pettyCashLabel: string
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-200/90 bg-gradient-to-b from-violet-50/80 via-white to-slate-50/50 px-6 py-14 dark:border-violet-500/30 dark:from-violet-950/25 dark:via-slate-900/50 dark:to-slate-900/30">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25">
          <Store className="h-8 w-8" strokeWidth={1.5} aria-hidden />
        </span>
        <p className="max-w-[22rem] text-center text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
          {emptyLabel}
        </p>
      </div>
    )
  }
  const maxSales = Math.max(...rows.map((r) => Math.max(r.sales, 0)), 1)
  const chartInput = rows.map((r) => ({
    shop_id: r.shop_id,
    name: r.name,
    sales: r.sales,
    color: r.color,
  }))
  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="overflow-hidden rounded-2xl border border-violet-100/90 bg-gradient-to-br from-violet-50/90 via-white to-sky-50/40 p-4 shadow-inner dark:border-violet-500/20 dark:from-violet-950/30 dark:via-slate-900/40 dark:to-slate-900/20">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-violet-600/85 dark:text-violet-300/85">
          {chartCaption}
        </p>
        <TopShopsSalesBarChart rows={chartInput} currencyLabel={currencyLabel} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row, idx) => {
          const widthPct = Math.max(6, Math.round((Math.max(row.sales, 0) / maxSales) * 100))
          const profitTone =
            row.profit > 0
              ? 'text-emerald-700 dark:text-emerald-300'
              : row.profit < 0
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-slate-700 dark:text-slate-200'
          const isFirst = idx === 0
          const rank = idx + 1
          return (
            <div
              key={`top-shop-${row.shop_id}`}
              className={`min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-900/50 ${
                isFirst ? 'border-slate-200 dark:border-slate-600' : 'border-slate-200 dark:border-slate-600'
              } ${!row.is_active ? 'opacity-[0.92]' : ''}`}
            >
              {isFirst ? (
                <div
                  className="h-1 w-full shrink-0 bg-gradient-to-l from-amber-400 via-amber-500 to-orange-500"
                  aria-hidden
                />
              ) : null}

              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums leading-none text-white shadow-md ring-2 ring-slate-200/90 dark:ring-slate-600 sm:h-11 sm:w-11 sm:text-sm"
                    style={{ backgroundColor: row.color }}
                    aria-label={`#${rank}`}
                  >
                    {rank}
                  </div>
                  <div className="min-w-0 flex-1 basis-[12rem]">
                    <p
                      className="text-start text-sm font-bold leading-snug text-slate-900 dark:text-slate-50 sm:text-base"
                      title={row.name}
                    >
                      {row.name}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        row.is_active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100'
                          : 'bg-slate-200/90 text-slate-600 dark:bg-slate-600/40 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          row.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        aria-hidden
                      />
                      {row.is_active ? activeLabel : inactiveLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700/80">
                  <p className="text-start text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {salesLabel}
                  </p>
                  <p className="mt-0.5 text-start text-2xl font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {formatCompactNumber(row.sales)}
                    <span className="ms-1.5 align-baseline text-xs font-medium text-slate-400 dark:text-slate-500">
                      {currencyLabel}
                    </span>
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/80">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(to left, ${row.color}, ${row.color}dd)`,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white px-3 py-2.5 dark:border-emerald-800/50 dark:from-emerald-950/30 dark:to-slate-900/40">
                    <p className="flex items-center gap-1 text-start text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/80">
                      <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
                      {profitLabel}
                    </p>
                    <p className={`mt-1 text-start text-lg font-bold tabular-nums leading-tight ${profitTone}`}>
                      {formatCompactNumber(row.profit)}
                      <span className="ms-1.5 align-baseline text-xs font-medium text-slate-400 opacity-90 dark:text-slate-500">
                        {currencyLabel}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-white px-3 py-2.5 dark:border-sky-800/50 dark:from-sky-950/30 dark:to-slate-900/40">
                    <p className="flex items-center gap-1 text-start text-[10px] font-medium text-sky-700/80 dark:text-sky-300/80">
                      <Package className="h-3 w-3 shrink-0" aria-hidden />
                      {stockLabel}
                    </p>
                    <p className="mt-1 text-start text-lg font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                      {formatCompactNumber(row.stock)}
                      <span className="ms-1.5 align-baseline text-xs font-medium text-slate-400 dark:text-slate-500">
                        {currencyLabel}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <ShopMetricPill
                    icon={<TrendingUp className="h-3 w-3 text-emerald-600" aria-hidden />}
                    label={totalSoldLabel}
                    value={row.totalSold}
                    currencyLabel={currencyLabel}
                    tone="emerald"
                  />
                  <ShopMetricPill
                    icon={<Wallet className="h-3 w-3 text-amber-600" aria-hidden />}
                    label={expensesLabel}
                    value={row.expenses}
                    currencyLabel={currencyLabel}
                    tone="amber"
                  />
                  <ShopMetricPill
                    icon={<Users className="h-3 w-3 text-violet-600" aria-hidden />}
                    label={receivablesLabel}
                    value={row.receivables}
                    currencyLabel={currencyLabel}
                    tone="violet"
                  />
                  <ShopMetricPill
                    icon={<RotateCcw className="h-3 w-3 text-rose-600" aria-hidden />}
                    label={returnedLabel}
                    value={row.returned}
                    currencyLabel={currencyLabel}
                    tone="rose"
                  />
                  <ShopMetricPill
                    icon={<Banknote className="h-3 w-3 text-slate-600" aria-hidden />}
                    label={discountsLabel}
                    value={row.discounts}
                    currencyLabel={currencyLabel}
                    tone="slate"
                  />
                  <ShopMetricPill
                    icon={<Coins className="h-3 w-3 text-sky-600" aria-hidden />}
                    label={pettyCashLabel}
                    value={row.pettyCash}
                    currencyLabel={currencyLabel}
                    tone="sky"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
