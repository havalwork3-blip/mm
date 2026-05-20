import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Lightbulb,
  Loader2,
  Package,
  Palette,
  Save,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageAuthLoading } from '../../components/PageAuthLoading'
import { useLocale } from '../../context/LocaleContext'
import { useSyncedSession } from '../../hooks/useSyncedSession'
import { resolveActiveShopId } from '../../lib/activeShop'
import {
  fetchMerchantStorefrontSettings,
  patchMerchantStorefrontSettings,
} from '../../lib/merchantStorefrontSettingsApi'
import { StorefrontPreview } from '../storefront/StorefrontPreview'
import { storefrontStrings } from '../storefront/storefrontStrings'

const COLOR_PRESETS = [
  { id: 'orange', hex: '#FF5A00', label: 'Orange' },
  { id: 'amber', hex: '#f59e0b', label: 'Amber' },
  { id: 'violet', hex: '#7c3aed', label: 'Violet' },
  { id: 'emerald', hex: '#059669', label: 'Emerald' },
  { id: 'blue', hex: '#2563eb', label: 'Blue' },
]

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Globe
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  )
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white dark:focus:border-violet-500'

export function MerchantOnlineShopPage() {
  const { t, lang } = useLocale()
  const sf = storefrontStrings(lang)
  const { me, authPending, showLogin, canAccessShopData, needsShop, shopImpersonation } =
    useSyncedSession()
  const previewShopId = resolveActiveShopId(me, shopImpersonation)
  const shopDisplayName = me?.shop_name || 'Shop'

  const [catalogTitle, setCatalogTitle] = useState('')
  const [catalogSubtitle, setCatalogSubtitle] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [accentColor, setAccentColor] = useState('#FF5A00')
  const [storefrontUrl, setStorefrontUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await fetchMerchantStorefrontSettings()
      setCatalogTitle(row.catalog_title || '')
      setCatalogSubtitle(row.catalog_subtitle || '')
      setWelcomeMessage(row.welcome_message || '')
      setAccentColor(row.accent_color || '#FF5A00')
      setStorefrontUrl(row.storefront_url || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (canAccessShopData) void load()
  }, [canAccessShopData, load])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(id)
  }, [saved])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await patchMerchantStorefrontSettings({
        catalog_title: catalogTitle.trim(),
        catalog_subtitle: catalogSubtitle.trim(),
        welcome_message: welcomeMessage.trim(),
        accent_color: accentColor.trim() || '#FF5A00',
      })
      setSaved(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    if (!storefrontUrl) return
    try {
      await navigator.clipboard.writeText(storefrontUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (authPending) return <PageAuthLoading />

  if (showLogin) {
    return <p className="text-slate-600 dark:text-slate-400">{t('dash.signIn')}</p>
  }

  if (me && !me.online_storefront_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <Globe className="mx-auto h-12 w-12 text-slate-300" aria-hidden />
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{t('onlineOrders.notEnabled')}</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {t('nav.dashboard')}
        </Link>
      </div>
    )
  }

  if (needsShop) {
    return (
      <p className="text-sm text-amber-800 dark:text-amber-200">{t('inv.superuserShopHint')}</p>
    )
  }

  const devPreviewUrl = previewShopId ? `/store/?shop_id=${previewShopId}` : '/store/'

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF5A00] via-[#ff7a2e] to-[#ffb347] p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              {t('onlineShop.enabledBadge')}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t('onlineShop.title')}</h1>
            <p className="mt-1 max-w-xl text-sm text-white/90">{t('onlineShop.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/online-orders"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/25"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {t('onlineShop.viewOrders')}
            </Link>
            {storefrontUrl ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#FF5A00] shadow-md transition hover:bg-white/95"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('onlineShop.openStore')}
              </a>
            ) : import.meta.env.DEV ? (
              <Link
                to={devPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#FF5A00] shadow-md"
              >
                <ExternalLink className="h-4 w-4" aria-hidden />
                {t('onlineShop.openStore')}
              </Link>
            ) : null}
          </div>
        </div>
        <div
          className="pointer-events-none absolute -end-8 -top-8 h-40 w-40 rounded-full bg-white/10"
          aria-hidden
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <form onSubmit={(e) => void save(e)} className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="space-y-5">
            <SectionCard title={t('onlineShop.brandingSection')} icon={Globe}>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('onlineShop.catalogTitle')}
                </label>
                <input
                  value={catalogTitle}
                  onChange={(e) => setCatalogTitle(e.target.value)}
                  placeholder={t('onlineShop.catalogTitleHint')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('onlineShop.catalogSubtitle')}
                </label>
                <input
                  value={catalogSubtitle}
                  onChange={(e) => setCatalogSubtitle(e.target.value)}
                  placeholder={t('onlineShop.catalogSubtitleHint')}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('onlineShop.welcomeMessage')}
                </label>
                <textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  rows={3}
                  placeholder={t('onlineShop.welcomeMessageHint')}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </SectionCard>

            <SectionCard title={t('onlineShop.themeSection')} icon={Palette}>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('onlineShop.colorPresets')}</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAccentColor(p.hex)}
                    className={[
                      'h-9 w-9 rounded-full ring-2 ring-offset-2 transition dark:ring-offset-slate-900',
                      accentColor.toLowerCase() === p.hex.toLowerCase()
                        ? 'ring-slate-800 dark:ring-white'
                        : 'ring-transparent hover:scale-105',
                    ].join(' ')}
                    style={{ backgroundColor: p.hex }}
                    title={p.label}
                    aria-label={p.label}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-600"
                />
                <input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  dir="ltr"
                  className={`${inputClass} max-w-[10rem] font-mono`}
                />
              </div>
            </SectionCard>

            <SectionCard title={t('onlineShop.publishSection')} icon={ExternalLink}>
              {storefrontUrl ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <a
                    href={storefrontUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate rounded-xl bg-slate-100 px-3 py-2.5 font-mono text-xs text-violet-700 hover:underline dark:bg-slate-800 dark:text-violet-300"
                  >
                    {storefrontUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    {copied ? t('onlineShop.copied') : t('onlineShop.copyLink')}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300">{t('onlineShop.noHostYet')}</p>
              )}
              {import.meta.env.DEV ? (
                <p className="text-xs text-slate-500">
                  {t('admin.storefrontLocalTest')}{' '}
                  <Link to={devPreviewUrl} className="font-mono text-violet-600 underline dark:text-violet-400">
                    /store/
                  </Link>
                </p>
              ) : null}
            </SectionCard>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 dark:border-slate-700 dark:bg-slate-800/30">
              <div className="flex items-start gap-3">
                <Package className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t('onlineShop.manageProducts')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('onlineShop.manageProductsHint')}
                  </p>
                  <Link
                    to="/inventory"
                    className="mt-3 inline-flex text-xs font-semibold text-violet-600 hover:underline dark:text-violet-400"
                  >
                    {t('onlineShop.goInventory')} →
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Lightbulb className="h-4 w-4" aria-hidden />
                <p className="text-sm font-bold">{t('onlineShop.tipsTitle')}</p>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-amber-800/90 dark:text-amber-200/80">
                <li>• {t('onlineShop.tip1')}</li>
                <li>• {t('onlineShop.tip2')}</li>
                <li>• {t('onlineShop.tip3')}</li>
              </ul>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            ) : null}
            {saved ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                {t('onlineShop.saved')}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50 sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? t('common.loading') : t('settings.save')}
            </button>
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('onlineShop.livePreview')}
              </p>
              <StorefrontPreview
                shopName={shopDisplayName}
                catalogTitle={catalogTitle}
                catalogSubtitle={catalogSubtitle}
                welcomeMessage={welcomeMessage}
                accentColor={accentColor}
                labels={{
                  hello: sf.hello,
                  search: sf.searchPlaceholder,
                  shopNow: sf.shopNow,
                  home: sf.home,
                  cart: sf.cart,
                }}
              />
            </div>
          </aside>
        </form>
      )}
    </div>
  )
}
