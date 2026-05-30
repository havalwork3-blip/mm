import {
  ExternalLink,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Menu,
  Package,
  Settings,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import { fetchContactStats, marketingLogout } from '../../lib/marketingApi'
import { useMarketingSession } from '../../context/MarketingSessionContext'
import { CMS_NAV_GROUPS } from './marketingCmsConfig'

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
    isActive
      ? 'bg-amber-600/15 font-medium text-amber-300 ring-1 ring-amber-600/30'
      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
  }`
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
}

export function MarketingCMSLayout() {
  const { editor, loading, logoutLocal } = useMarketingSession()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeMobileSidebar = useCallback(() => {
    if (isMobileViewport()) setSidebarOpen(false)
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      const s = await fetchContactStats()
      setUnread(s.unread)
    } catch {
      setUnread(0)
    }
  }, [])

  useEffect(() => {
    if (!editor) return
    void refreshStats()
    const t = setInterval(() => void refreshStats(), 60000)
    return () => clearInterval(t)
  }, [refreshStats, editor])

  useEffect(() => {
    closeMobileSidebar()
  }, [location.pathname, closeMobileSidebar])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen && isMobileViewport() ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  async function handleLogout() {
    await marketingLogout()
    logoutLocal()
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0a0c10] text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" aria-hidden />
      </div>
    )
  }

  if (!editor) {
    return <Navigate to="/site-cms/login" replace />
  }

  return (
    <div className="flex min-h-dvh bg-[#0a0c10] text-slate-100" dir="rtl">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          aria-label="داخستنی مێنیو"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-[min(100vw-2.5rem,19rem)] max-w-[85vw] flex-col border-l border-slate-800/80 bg-[#0d1017] shadow-2xl transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-72 lg:max-w-none lg:translate-x-0 lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/brand-logo.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="truncate font-bold text-white">MM IRAQ CMS</p>
              <p className="truncate text-xs text-slate-500">{editor.email}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
            aria-label="داخستن"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain p-3 pb-6">
          <ul className="space-y-1">
            <li>
              <NavLink to="/site-cms" end className={navClass} onClick={closeMobileSidebar}>
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                سەرەوە
              </NavLink>
            </li>
            <li>
              <NavLink to="/site-cms/products" className={navClass} onClick={closeMobileSidebar}>
                <Package className="h-4 w-4 shrink-0" />
                کاڵا و پۆست
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/site-cms/inbox"
                className={navClass}
                onClick={() => {
                  void refreshStats()
                  closeMobileSidebar()
                }}
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span className="flex-1">پەیامەکان</span>
                {unread > 0 && (
                  <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
            </li>
            <li>
              <NavLink to="/site-cms/settings" className={navClass} onClick={closeMobileSidebar}>
                <Settings className="h-4 w-4 shrink-0" />
                ڕێکخستن
              </NavLink>
            </li>
          </ul>

          {CMS_NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={`/site-cms/content/${item.id}`}
                        className={navClass}
                        onClick={closeMobileSidebar}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-slate-800/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href="https://mmiraq.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            بینینی ماڵپەڕ
          </a>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            POS داشبۆرد
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-950/30"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            دەرچوون
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-[#0d1017]/95 px-3 py-2.5 backdrop-blur supports-[padding:max(0px)]:pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-200"
            aria-label="کردنەوەی مێنیو"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate font-semibold text-white">MM IRAQ CMS</span>
          {unread > 0 ? (
            <Link
              to="/site-cms/inbox"
              className="relative rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-200"
              aria-label="پەیامە نوێیەکان"
            >
              <Mail className="h-5 w-5" />
              <span className="absolute -left-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            </Link>
          ) : (
            <span className="w-10" aria-hidden />
          )}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden">
          <Outlet context={{ refreshStats }} />
        </div>
      </div>
    </div>
  )
}
