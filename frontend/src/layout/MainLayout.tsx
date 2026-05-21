import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  DollarSign,
  FolderKanban,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  QrCode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sun,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LangSwitcher } from '../components/LangSwitcher'
import { OnlineOrderNotificationLayer } from '../components/OnlineOrderNotificationLayer'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { useTheme } from '../context/ThemeContext'
import { useOnlineOrdersPendingCount } from '../hooks/useOnlineOrdersPendingCount'
import { apiJson, getGlobalView, setGlobalView, setSuperuserShopId } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type { Me, ShopRow } from '../types/api'

/** Served from `public/brand-logo.png` (copy of `frontend/logo/image.png`). */
const BRAND_LOGO_SRC = '/brand-logo.png'

type NavLeaf = {
  to: string
  labelKey: string
  icon: LucideIcon
  end?: boolean
  anyPermission?: string[]
  ownerOrSuperuserOnly?: boolean
  /** Visible when the active shop has online storefront enabled (all shop staff). */
  requiresOnlineStorefront?: boolean
  /** Shop POS settings (receipt, shortcuts): visible to owner or employee, not superuser sidebar. */
  employeeOnly?: boolean
  /** Show pending online orders count badge (sidebar). */
  showOnlineOrdersBadge?: boolean
}

type ShopNavEntry =
  | ({ type: 'item' } & NavLeaf)
  | {
      type: 'group'
      id: string
      labelKey: string
      icon: LucideIcon
      items: NavLeaf[]
    }

function navLeafVisible(me: Me | null, item: NavLeaf): boolean {
  if (item.employeeOnly) {
    return Boolean(
      me &&
        !me.is_superuser &&
        (me.role === 'employee' ||
          me.role === 'owner' ||
          me.role === 'manager' ||
          me.role === 'receipt_editor'),
    )
  }
  if (item.ownerOrSuperuserOnly) {
    return Boolean(
      me?.is_superuser || me?.role === 'owner' || me?.role === 'manager',
    )
  }
  if (item.requiresOnlineStorefront) {
    if (!me?.online_storefront_enabled) return false
    return Boolean(
      me.is_superuser ||
        me.role === 'owner' ||
        me.role === 'manager' ||
        me.role === 'employee' ||
        me.role === 'receipt_editor',
    )
  }
  if (item.anyPermission?.length) return hasPerm(me, ...item.anyPermission)
  return true
}

function filterShopNav(me: Me | null, entries: ShopNavEntry[]): ShopNavEntry[] {
  const out: ShopNavEntry[] = []
  for (const entry of entries) {
    if (entry.type === 'item') {
      if (navLeafVisible(me, entry)) out.push(entry)
      continue
    }
    const items = entry.items.filter((i) => navLeafVisible(me, i))
    if (items.length === 0) continue
    out.push({ ...entry, items })
  }
  return out
}

const SHOP_NAV: ShopNavEntry[] = [
  { type: 'item', to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  {
    type: 'group',
    id: 'sales',
    labelKey: 'nav.salesSection',
    icon: ShoppingCart,
    items: [
      {
        to: '/pos',
        labelKey: 'nav.pos',
        icon: ShoppingCart,
        anyPermission: ['view_product', 'add_sale'],
      },
      {
        to: '/jard',
        labelKey: 'nav.jard',
        icon: FolderKanban,
        anyPermission: ['view_product', 'view_sale'],
      },
      {
        to: '/sales-returns',
        labelKey: 'nav.salesReturns',
        icon: ClipboardList,
        anyPermission: ['view_sale', 'add_sale'],
      },
    ],
  },
  {
    type: 'group',
    id: 'online',
    labelKey: 'nav.onlineSection',
    icon: Globe,
    items: [
      {
        to: '/online-pricing',
        labelKey: 'nav.onlinePricing',
        icon: DollarSign,
        requiresOnlineStorefront: true,
      },
      {
        to: '/online-shop',
        labelKey: 'nav.onlineShop',
        icon: Globe,
        requiresOnlineStorefront: true,
      },
      {
        to: '/online-orders',
        labelKey: 'nav.onlineOrders',
        icon: ShoppingCart,
        requiresOnlineStorefront: true,
        showOnlineOrdersBadge: true,
      },
    ],
  },
  {
    type: 'group',
    id: 'inventory',
    labelKey: 'nav.inventorySection',
    icon: Package,
    items: [
      {
        to: '/inventory',
        labelKey: 'nav.inventory',
        icon: Package,
        anyPermission: ['view_product'],
      },
    ],
  },
  {
    type: 'group',
    id: 'purchasing',
    labelKey: 'nav.purchasingSection',
    icon: Store,
    items: [
      {
        to: '/manage/companies',
        labelKey: 'nav.companies',
        icon: Store,
        anyPermission: ['view_company'],
      },
      {
        to: '/manage/purchases',
        labelKey: 'nav.purchases',
        icon: ClipboardList,
        anyPermission: ['view_purchase'],
      },
      {
        to: '/manage/purchase-returns',
        labelKey: 'nav.purchaseReturns',
        icon: ClipboardList,
        anyPermission: ['view_purchase'],
      },
    ],
  },
  {
    type: 'group',
    id: 'customers',
    labelKey: 'nav.customersSection',
    icon: Users,
    items: [
      {
        to: '/manage/customers',
        labelKey: 'nav.customers',
        icon: Users,
        anyPermission: ['view_customer'],
      },
    ],
  },
  {
    type: 'group',
    id: 'finance',
    labelKey: 'nav.financeSection',
    icon: TrendingUp,
    items: [
      {
        to: '/manage/expenses',
        labelKey: 'nav.expenses',
        icon: Wallet,
        anyPermission: ['view_expense'],
      },
      {
        to: '/manage/shareholders',
        labelKey: 'nav.shareholders',
        icon: TrendingUp,
        anyPermission: ['view_shareholder'],
      },
      {
        to: '/profit',
        labelKey: 'nav.profit',
        icon: TrendingUp,
        anyPermission: ['view_profitreport'],
      },
    ],
  },
  {
    type: 'group',
    id: 'cash',
    labelKey: 'nav.cashSection',
    icon: Wallet,
    items: [
      {
        to: '/manage/opening-cash',
        labelKey: 'nav.openingCash',
        icon: Wallet,
        anyPermission: ['view_openingcash', 'view_shopdayopeningcash'],
      },
      {
        to: '/cashier',
        labelKey: 'nav.cashier',
        icon: Wallet,
        anyPermission: ['view_cashier'],
      },
    ],
  },
  {
    type: 'group',
    id: 'staff-debts',
    labelKey: 'nav.staffDebtsSection',
    icon: Users,
    items: [
      {
        to: '/debts',
        labelKey: 'nav.debts',
        icon: Users,
        anyPermission: ['view_employeedebt'],
      },
    ],
  },
  {
    type: 'item',
    to: '/catalog',
    labelKey: 'nav.catalog',
    icon: BookOpen,
  },
  {
    type: 'item',
    to: '/settings',
    labelKey: 'nav.settings',
    icon: Settings,
    employeeOnly: true,
  },
]

function roleLabel(
  t: (k: string) => string,
  me: { is_superuser: boolean; role: string },
) {
  if (me.is_superuser) return t('role.superuser')
  const k = `role.${me.role}`
  const s = t(k)
  return s === k ? me.role : s
}

const ADMIN_SUB: { to: string; labelKey: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/system/shops', labelKey: 'admin.shops', icon: Store },
  { to: '/system/users', labelKey: 'admin.users', icon: Users },
  { to: '/system/qr-social', labelKey: 'admin.qrSocial', icon: QrCode },
]

function navLinkClass(collapsed: boolean, isActive: boolean) {
  return `flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-violet-600/25 text-white ring-1 ring-violet-500/40'
      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
  } ${collapsed ? 'justify-center px-0' : ''}`
}

function NavPendingBadge({
  count,
  collapsed,
}: {
  count: number
  collapsed: boolean
}) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  if (collapsed) {
    return (
      <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-slate-900 ring-2 ring-[var(--sidebar-bg,#0f172a)]">
        {label}
      </span>
    )
  }
  return (
    <span className="ms-auto shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold leading-none text-slate-900">
      {label}
    </span>
  )
}

function NavLinkWithOptionalBadge({
  to,
  end,
  collapsed,
  label,
  icon: Icon,
  badgeCount,
  showBadge,
  onNavigate,
}: {
  to: string
  end?: boolean
  collapsed: boolean
  label: string
  icon: LucideIcon
  badgeCount: number
  showBadge?: boolean
  onNavigate: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          navLinkClass(collapsed, isActive),
          showBadge && badgeCount > 0 ? 'relative' : '',
        ].join(' ')
      }
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      {showBadge && collapsed && badgeCount > 0 ? (
        <span className="relative shrink-0">
          <Icon className="h-5 w-5 opacity-90" aria-hidden />
          <NavPendingBadge count={badgeCount} collapsed />
        </span>
      ) : (
        <Icon className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
      )}
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 break-words text-start leading-snug">{label}</span>
          {showBadge ? <NavPendingBadge count={badgeCount} collapsed={false} /> : null}
        </>
      )}
    </NavLink>
  )
}

export function MainLayout() {
  const { t, lang, setLang } = useLocale()
  const { me, loading, logout } = useSession()
  const { resolvedMode, toggleTheme } = useTheme()
  const loc = useLocation()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(() =>
    localStorage.getItem('sidebar_collapsed') === '1',
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [shops, setShops] = useState<ShopRow[]>([])
  const [shopOverride, setShopOverride] = useState('')
  const [globalViewOn, setGlobalViewOn] = useState(() => getGlobalView())
  const [shopTick, setShopTick] = useState(0)
  const [adminAccordionOpen, setAdminAccordionOpen] = useState(() =>
    loc.pathname.startsWith('/system') || loc.pathname.startsWith('/admin'),
  )

  useEffect(() => {
    if (loc.pathname.startsWith('/system') || loc.pathname.startsWith('/admin')) {
      setAdminAccordionOpen(true)
    }
  }, [loc.pathname])

  const loadShops = useCallback(async () => {
    if (!me?.is_superuser) return
    try {
      const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/')
      setShops(Array.isArray(data) ? data : data.results)
    } catch {
      setShops([])
    }
  }, [me?.is_superuser])

  useEffect(() => {
    void loadShops()
  }, [loadShops])

  useEffect(() => {
    if (me?.is_superuser) {
      const s = localStorage.getItem('pos_shop_id')
      setShopOverride(s ?? '')
      setGlobalViewOn(getGlobalView())
    }
  }, [me?.is_superuser, loc.pathname, shopTick])

  useEffect(() => {
    setMobileOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  const shopDisplayName = useMemo(() => {
    if (!me) return ''
    if (me.shop_name) return me.shop_name
    if (me.is_superuser) {
      const id = localStorage.getItem('pos_shop_id')
      if (id && shops.length) {
        const row = shops.find((s) => String(s.id) === id)
        return row?.name ?? `#${id}`
      }
      if (globalViewOn) return t('nav.globalView')
      return t('settings.noShop')
    }
    return ''
  }, [me, shops, globalViewOn, t, shopTick])

  const filteredShopNav = useMemo(() => filterShopNav(me, SHOP_NAV), [me])

  const onlineOrdersBadgeEnabled = Boolean(
    me?.online_storefront_enabled &&
      (!me.is_superuser || Boolean((shopOverride || localStorage.getItem('pos_shop_id') || '').trim())),
  )
  const pendingOnlineOrders = useOnlineOrdersPendingCount(onlineOrdersBadgeEnabled)

  function applyShop(nextShopId?: string) {
    const v = (nextShopId ?? shopOverride).trim()
    setGlobalView(false)
    setGlobalViewOn(false)
    setSuperuserShopId(v || null)
    if (!v) localStorage.removeItem('pos_shop_id')
    else localStorage.setItem('pos_shop_id', v)
    setShopOverride(v)
    setShopTick((n) => n + 1)
    window.dispatchEvent(new Event('mm-dashboard-refresh'))
    window.dispatchEvent(new Event('mm-session-refresh'))
  }

  function toggleGlobalView(checked: boolean) {
    setGlobalView(checked)
    setGlobalViewOn(checked)
    if (checked) {
      setSuperuserShopId(null)
    } else {
      const v = (shopOverride || localStorage.getItem('pos_shop_id') || '').trim()
      setSuperuserShopId(v || null)
    }
    setShopTick((n) => n + 1)
    window.dispatchEvent(new Event('mm-dashboard-refresh'))
    window.dispatchEvent(new Event('mm-session-refresh'))
  }

  const showSidebar = Boolean(me)

  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-[var(--app-bg-color,#f1f5f9)] text-slate-500 dark:bg-slate-900 dark:text-slate-300"
      >
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--app-bg-color,#f1f5f9)]">
      {showSidebar && (
        <>
          <header className="fixed inset-x-0 top-0 z-[110] flex h-14 min-h-[3.5rem] items-center gap-2 border-b border-slate-200 bg-white/95 px-2 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/95 md:hidden">
            <button
              type="button"
              className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 shadow-sm active:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 ps-1 text-start">
              <img
                src={BRAND_LOGO_SRC}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg object-contain"
              />
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold leading-tight text-slate-900 dark:text-white">
                  {t('app.title')}
                </p>
                {shopDisplayName ? (
                  <p className="mt-0.5 break-words text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    {shopDisplayName}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:text-violet-300"
                  aria-label={resolvedMode === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
                  title={resolvedMode === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
                >
                  {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <LangSwitcher lang={lang} setLang={setLang} t={t} compact />
              </div>
            </div>
          </header>

          {mobileOpen && (
            <button
              type="button"
              className="fixed inset-0 z-[100] bg-black/50 md:hidden"
              aria-label={t('nav.closeMenu')}
              onClick={() => setMobileOpen(false)}
            />
          )}

          <aside
            className={`fixed inset-y-0 start-0 z-[105] flex w-[min(100vw-2.5rem,16rem)] max-w-[18rem] flex-col border-slate-700/60 bg-[var(--sidebar-bg,#0f172a)] text-slate-100 shadow-2xl transition-transform duration-200 ease-out md:z-40 md:max-w-none md:border-e md:shadow-xl md:rtl:border-s md:rtl:border-e-0 ${
              collapsed ? 'md:w-[4.25rem]' : 'md:w-64'
            } ${
              mobileOpen
                ? 'translate-x-0 rtl:translate-x-0'
                : '-translate-x-full rtl:translate-x-full md:translate-x-0 md:rtl:translate-x-0'
            }`}
          >
            {me?.is_superuser && (
              <div className="border-b border-slate-700/80 p-3 md:hidden">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg bg-slate-800/80 px-2 py-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 rounded border-slate-500"
                    checked={globalViewOn}
                    onChange={(e) => toggleGlobalView(e.target.checked)}
                  />
                  <span className="break-words">{t('nav.globalView')}</span>
                </label>
                <div className="mt-2 flex min-h-[44px] items-center gap-2">
                  <select
                    className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                    value={shopOverride}
                    onChange={(e) => applyShop(e.target.value)}
                  >
                    <option value="">{t('settings.noShop')}</option>
                    {shops.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div
              className={`flex min-h-16 shrink-0 items-center gap-2 border-b border-slate-700/80 py-2 ${collapsed ? 'justify-center px-1' : 'px-3'}`}
            >
              <img
                src={BRAND_LOGO_SRC}
                alt=""
                className={`shrink-0 rounded-lg object-contain ${collapsed ? 'h-11 w-11' : 'h-14 w-14'}`}
              />
              {!collapsed && (
                <div className="min-w-0 flex-1 text-start">
                  <p className="break-words text-sm font-semibold leading-snug text-white">{t('app.title')}</p>
                  <p className="break-words text-[11px] leading-snug text-slate-400" title={shopDisplayName}>
                    {shopDisplayName}
                  </p>
                </div>
              )}
            </div>

            <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-visible overscroll-y-contain py-3">
              <ul className="space-y-0.5 px-2">
                {filteredShopNav.map((entry) => {
                  if (entry.type === 'item') {
                    const ItemIcon = entry.icon
                    return (
                      <li key={entry.to + (entry.end ? '-e' : '')}>
                        <NavLink
                          to={entry.to}
                          end={entry.end}
                          className={({ isActive }) => navLinkClass(collapsed, isActive)}
                          title={collapsed ? t(entry.labelKey) : undefined}
                          onClick={() => setMobileOpen(false)}
                        >
                          <ItemIcon className="h-5 w-5 shrink-0 opacity-90" />
                          {!collapsed && (
                            <span className="min-w-0 flex-1 break-words text-start leading-snug">
                              {t(entry.labelKey)}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    )
                  }
                  return (
                    <Fragment key={entry.id}>
                      {!collapsed && (
                        <li className="list-none px-3 pt-2 pb-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {t(entry.labelKey)}
                          </p>
                        </li>
                      )}
                      <li className="list-none">
                        <ul
                          className={
                            collapsed
                              ? 'space-y-0.5'
                              : 'ms-1 space-y-0.5 border-s border-slate-600/50 ps-2'
                          }
                        >
                          {entry.items.map((item) => (
                            <li key={item.to + (item.end ? '-e' : '')}>
                              <NavLinkWithOptionalBadge
                                to={item.to}
                                end={item.end}
                                collapsed={collapsed}
                                label={t(item.labelKey)}
                                icon={item.icon}
                                badgeCount={pendingOnlineOrders}
                                showBadge={item.showOnlineOrdersBadge}
                                onNavigate={() => setMobileOpen(false)}
                              />
                            </li>
                          ))}
                        </ul>
                      </li>
                    </Fragment>
                  )
                })}
              </ul>

              {me?.is_superuser &&
                (collapsed ? (
                  <ul className="mt-2 space-y-1 border-t border-slate-700/60 px-2 pt-3">
                    {ADMIN_SUB.map(({ to, labelKey, icon: Icon, end }) => (
                      <li key={to}>
                        <NavLink
                          to={to}
                          end={end}
                          className={({ isActive }) => navLinkClass(true, isActive)}
                          title={t(labelKey)}
                          onClick={() => setMobileOpen(false)}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-2 border-t border-slate-700/60 px-2 pt-3">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm font-medium text-slate-200 hover:bg-slate-800/80"
                      onClick={() => setAdminAccordionOpen((o) => !o)}
                      aria-expanded={adminAccordionOpen}
                      id="admin-nav-accordion"
                    >
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                          adminAccordionOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      />
                      <ShieldCheck className="h-5 w-5 shrink-0 text-violet-400" />
                      <span className="min-w-0 flex-1 break-words leading-snug">{t('admin.systemAdmin')}</span>
                    </button>
                    {adminAccordionOpen && (
                      <ul
                        className="mt-1 space-y-0.5 border-s border-slate-600/80 ps-3 ms-1"
                        role="region"
                        aria-labelledby="admin-nav-accordion"
                      >
                        {ADMIN_SUB.map(({ to, labelKey, icon: Icon, end }) => (
                          <li key={to}>
                            <NavLink
                              to={to}
                              end={end}
                              className={({ isActive }) =>
                                `ms-0 flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                                  isActive
                                    ? 'bg-violet-600/30 font-medium text-white ring-1 ring-violet-500/50'
                                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                                }`
                              }
                              onClick={() => setMobileOpen(false)}
                            >
                              <Icon className="h-4 w-4 shrink-0 opacity-90" />
                              <span className="min-w-0 flex-1 break-words text-start leading-snug">
                                {t(labelKey)}
                              </span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

              {me?.is_superuser && (
                <div
                  className={`mx-2 mt-4 hidden space-y-2 rounded-xl border border-slate-700/80 bg-slate-800/50 p-2 md:block ${collapsed ? 'md:hidden' : ''}`}
                >
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-slate-500"
                      checked={globalViewOn}
                      onChange={(e) => toggleGlobalView(e.target.checked)}
                    />
                    <span className="break-words leading-snug">{t('nav.globalView')}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      className="min-h-9 min-w-0 flex-1 rounded border border-slate-600 bg-slate-900/80 px-1.5 py-2 text-[11px] text-slate-100"
                      value={shopOverride}
                      onChange={(e) => applyShop(e.target.value)}
                    >
                      <option value="">{t('settings.noShop')}</option>
                      {shops.map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </nav>

            <div className="border-t border-slate-700/80 p-2">
              <div className={`mb-2 hidden md:block ${collapsed ? 'flex justify-center' : 'px-1'}`}>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500 hover:text-violet-300"
                    aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
                    title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
                  >
                    {collapsed ? (
                      <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" aria-hidden />
                    ) : (
                      <PanelLeftClose className="h-4 w-4 rtl:rotate-180" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-500 hover:text-violet-300"
                    aria-label={resolvedMode === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
                    title={resolvedMode === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}
                  >
                    {resolvedMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </button>
                  <LangSwitcher
                    lang={lang}
                    setLang={setLang}
                    t={t}
                    compact
                    variant="dark"
                    iconOnly
                  />
                </div>
              </div>

              {me && (
                <div
                  className={`rounded-lg bg-slate-800/90 ${collapsed ? 'px-1 py-2 text-center' : 'px-2 py-2 text-start'}`}
                >
                  {!collapsed && (
                    <>
                      <p className="break-all text-xs font-medium text-white">{me.email}</p>
                      <p className="mt-0.5 break-words text-[10px] text-slate-400">{roleLabel(t, me)}</p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className={`mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg bg-slate-700 py-2 text-xs font-medium text-slate-100 hover:bg-slate-600 ${collapsed ? 'px-0' : ''}`}
                    title={t('nav.logout')}
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden />
                    {!collapsed && <span>{t('nav.logout')}</span>}
                  </button>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <div
        className="mm-app-main-shell"
        style={
          {
            ['--mm-mobile-header-h' as string]: showSidebar ? '3.5rem' : '0px',
            ['--mm-sidebar-w' as string]: showSidebar
              ? collapsed
                ? '4.25rem'
                : '16rem'
              : '0px',
          } as React.CSSProperties
        }
      >
        <main className="min-h-dvh min-w-0 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <OnlineOrderNotificationLayer />
    </div>
  )
}
