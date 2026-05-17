import { Globe2, Store } from 'lucide-react'
import { useEffect } from 'react'
import type { ShopRow } from '../types/api'

type Props = {
  t: (key: string) => string
  shops: ShopRow[]
  shopId: string
  onShopIdChange: (id: string) => void
  onApplyShop: () => void
  onEnableGlobalView: () => void
}

export function SuperuserDashboardScopeCard({
  t,
  shops,
  shopId,
  onShopIdChange,
  onApplyShop,
  onEnableGlobalView,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px] sm:p-6 lg:pr-64"
      role="presentation"
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="superuser-scope-title"
        aria-describedby="superuser-scope-hint"
        className="w-full max-w-lg rounded-2xl border-2 border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-violet-50/80 p-5 shadow-2xl ring-1 ring-amber-200/70 dark:border-amber-600/60 dark:from-amber-950/50 dark:via-slate-800 dark:to-violet-950/30 dark:ring-amber-800/50 sm:max-w-xl sm:p-6"
      >
        <div className="flex flex-wrap items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="superuser-scope-title"
              className="text-base font-semibold text-amber-950 dark:text-amber-100 sm:text-lg"
            >
              {t('dash.superuserScopeTitle')}
            </h2>
            <p
              id="superuser-scope-hint"
              className="mt-1.5 text-sm leading-relaxed text-amber-900/90 dark:text-amber-100/85"
            >
              {t('dash.superuserScopeHint')}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white/95 p-4 dark:border-slate-600 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('dash.superuserScopeShopOption')}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="sr-only">{t('dash.superuserScopeShopOption')}</span>
                <select
                  value={shopId}
                  onChange={(e) => onShopIdChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="">{t('settings.noShop')}</option>
                  {shops.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onApplyShop}
                disabled={!shopId.trim()}
                className="min-h-11 shrink-0 rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {t('dash.apply')}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-violet-200/90 bg-violet-50/90 p-4 dark:border-violet-700/50 dark:bg-violet-950/35">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              {t('dash.superuserScopeGlobalOption')}
            </p>
            <p className="mt-2 text-sm text-violet-900/90 dark:text-violet-100/85">
              {t('dash.superuserScopeGlobalHint')}
            </p>
            <button
              type="button"
              onClick={onEnableGlobalView}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-800"
            >
              <Globe2 className="h-4 w-4 shrink-0" aria-hidden />
              {t('dash.superuserScopeGlobalBtn')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
