import { Loader2, LogOut } from 'lucide-react'
import { Navigate, Outlet, Link } from 'react-router-dom'
import { marketingLogout } from '../../lib/marketingApi'
import { useMarketingSession } from '../../context/MarketingSessionContext'

export function MarketingCMSLayout() {
  const { editor, loading, logoutLocal } = useMarketingSession()

  async function handleLogout() {
    await marketingLogout()
    logoutLocal()
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    )
  }

  if (!editor) {
    return <Navigate to="/site-cms/login" replace />
  }

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100" dir="rtl">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="font-semibold text-white">بەڕێوەبردنی mmiraq.com</p>
            <p className="text-xs text-slate-400">{editor.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://mmiraq.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              بینینی ماڵپەڕ
            </a>
            <Link
              to="/"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
            >
              POS داشبۆرد
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              دەرچوون
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
