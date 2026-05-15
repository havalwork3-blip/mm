import { BadgeDollarSign, Boxes, Store, TicketPercent, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { apiJson } from '../../lib/api'
import type { AdminGlobalStats } from '../../types/api'

export function AdminOverviewPage() {
  const { t } = useLocale()
  const [dFrom, setDFrom] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  )
  const [dTo, setDTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [stats, setStats] = useState<AdminGlobalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = `?from=${encodeURIComponent(dFrom)}&to=${encodeURIComponent(dTo)}`
      const data = await apiJson<AdminGlobalStats>(`/api/admin/stats/${q}`)
      setStats(data)
    } catch (e) {
      setStats(null)
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [dFrom, dTo, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="text-start">
        <h1 className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{t('admin.globalReports')}</h1>
        <p className="mt-1 break-words text-sm text-slate-600">{t('admin.globalReportsDesc')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full min-w-0 sm:w-auto">
          <label className="block text-start text-xs font-medium text-slate-600">{t('dash.from')}</label>
          <input
            type="date"
            value={dFrom}
            onChange={(e) => setDFrom(e.target.value)}
            className="mt-1 w-full min-h-11 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto"
          />
        </div>
        <div className="w-full min-w-0 sm:w-auto">
          <label className="block text-start text-xs font-medium text-slate-600">{t('dash.to')}</label>
          <input
            type="date"
            value={dTo}
            onChange={(e) => setDTo(e.target.value)}
            className="mt-1 w-full min-h-11 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm sm:w-auto"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 w-full shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white sm:w-auto"
        >
          {loading ? t('common.loading') : t('dash.apply')}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {stats && (
        <div className="grid grid-cols-1 gap-4 text-start sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <Store className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{t('admin.totalShops')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stats.total_shops}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('admin.active')}: {stats.total_active_shops}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <Users className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{t('admin.activeUsers')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stats.total_active_users}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <BadgeDollarSign className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{t('admin.globalProfit')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stats.global_profit_usd}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">USD</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <TicketPercent className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{t('admin.globalDiscounts')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stats.global_discounts_usd}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">USD</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <Boxes className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="min-w-0 break-words text-xs font-medium leading-snug">{t('admin.globalStockValue')}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{stats.global_stock_value_usd}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">USD</p>
          </div>
        </div>
      )}
    </div>
  )
}
