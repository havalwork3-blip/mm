import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Map,
  Package,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import type { Me } from '../types/api'
import { CATALOG_NAV_LINKS } from './catalog/catalogNavLinks'
import { CATALOG_SECTION_IDS, type CatalogSectionId } from './catalog/catalogSectionIds'

function splitBody(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

const SECTION_ICONS: Record<CatalogSectionId, LucideIcon> = {
  intro: Sparkles,
  bigPicture: Store,
  parts: Cpu,
  navMap: Map,
  dashboard: LayoutDashboard,
  sales: ShoppingCart,
  inventory: Package,
  purchasing: ClipboardList,
  customers: Users,
  finance: TrendingUp,
  cash: Wallet,
  debts: CircleDollarSign,
  settings: Settings,
  admin: Shield,
  access: KeyRound,
  faq: HelpCircle,
}

function filterLinksForUser(links: { to: string; labelKey: string; superuserOnly?: boolean }[], me: Me) {
  return links.filter((l) => !l.superuserOnly || me.is_superuser)
}

export function CatalogPage() {
  const { t } = useLocale()
  const { me, loading } = useSession()
  const [q, setQ] = useState('')

  const visibleIds = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return [...CATALOG_SECTION_IDS]
    return CATALOG_SECTION_IDS.filter((id) => {
      const title = t(`catalog.section.${id}.title`)
      const body = t(`catalog.section.${id}.body`)
      const hay = `${title}\n${body}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [q, t])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 text-slate-600 dark:text-slate-400">
        {t('common.loading')}
      </div>
    )
  }

  if (!me) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
          <BookOpen className="h-8 w-8" aria-hidden />
        </div>
        <p className="text-base text-slate-700 dark:text-slate-300">{t('catalog.signInRequired')}</p>
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-indigo-500"
        >
          {t('dash.signIn')}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50/90 via-white to-slate-50/95 pb-24 pt-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:pt-6">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:max-w-4xl">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 p-[1px] shadow-xl shadow-violet-500/20">
          <div className="relative rounded-[calc(1.5rem-1px)] bg-white/95 px-5 py-8 dark:bg-slate-900/95 sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/10" />
            <div className="pointer-events-none absolute -bottom-12 -start-12 h-40 w-40 rounded-full bg-fuchsia-400/15 blur-3xl dark:bg-fuchsia-500/10" />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
                <BookMarked className="h-7 w-7" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
                  {t('catalog.heroEyebrow')}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
                  {t('catalog.pageTitle')}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
                  {t('catalog.pageSubtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search + TOC */}
        <div className="relative z-10 -mt-4 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90 sm:p-5">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500/70"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('catalog.searchPlaceholder')}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 ps-11 pe-4 text-sm text-slate-900 shadow-inner outline-none ring-0 transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:shadow-md focus:shadow-violet-500/10 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:bg-slate-800"
              autoComplete="off"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/80">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('catalog.onThisPage')}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{t('catalog.tocHint')}</p>
          </div>
          <nav aria-label={t('catalog.tocLabel')} className="mt-3 flex flex-wrap gap-2">
            {visibleIds.map((id) => (
              <a
                key={id}
                href={`#catalog-${id}`}
                className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-violet-500 dark:hover:bg-violet-950/40 dark:hover:text-violet-100"
              >
                <span className="truncate">{t(`catalog.section.${id}.title`)}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50 transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
              </a>
            ))}
          </nav>
          {q.trim() && visibleIds.length === 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {t('catalog.noMatch')}
            </p>
          ) : null}
        </div>

        {/* Sections */}
        <div className="mt-10 space-y-8 sm:space-y-10">
          {visibleIds.map((id, idx) => {
            const Icon = SECTION_ICONS[id]
            const rawLinks = CATALOG_NAV_LINKS[id]
            const links = rawLinks ? filterLinksForUser(rawLinks, me) : []
            const showSuperNote =
              (id === 'admin' || id === 'access') && !me.is_superuser && rawLinks?.some((l) => l.superuserOnly)

            return (
              <section
                key={id}
                id={`catalog-${id}`}
                className="group scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-md shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02] transition hover:border-violet-200/80 hover:shadow-lg hover:shadow-violet-500/[0.06] dark:border-slate-700/90 dark:bg-slate-900/55 dark:ring-white/[0.04] dark:hover:border-violet-500/30"
              >
                <div className="flex gap-0 sm:gap-0">
                  <div className="hidden w-1.5 shrink-0 bg-gradient-to-b from-violet-500 to-indigo-600 sm:block" aria-hidden />
                  <div className="min-w-0 flex-1 p-5 sm:p-6 sm:ps-5">
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300">
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono text-[11px] font-bold text-violet-400 dark:text-violet-500">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                            {t(`catalog.section.${id}.title`)}
                          </h2>
                        </div>
                        <div className="mt-4 space-y-3.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-[15px]">
                          {splitBody(t(`catalog.section.${id}.body`)).map((para, i) => (
                            <p key={i} className="text-pretty">
                              {para}
                            </p>
                          ))}
                        </div>

                        {showSuperNote ? (
                          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
                            {t('catalog.superuserRoutesNote')}
                          </p>
                        ) : null}

                        {links.length > 0 ? (
                          <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-700/80">
                            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                              {t('catalog.quickNavLabel')}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {links.map((l) => (
                                <Link
                                  key={`${id}-${l.to}`}
                                  to={l.to}
                                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/80 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm transition hover:border-violet-400 hover:from-violet-50 hover:to-indigo-50 hover:shadow-md dark:border-violet-500/30 dark:from-slate-800 dark:to-violet-950/40 dark:text-violet-100 dark:hover:border-violet-400/60"
                                >
                                  <span>{t(l.labelKey)}</span>
                                  <ArrowUpRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
