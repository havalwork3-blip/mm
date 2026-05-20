import { ExternalLink, Globe, Loader2, Save } from 'lucide-react'
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

export function MerchantOnlineShopPage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, canAccessShopData, needsShop, shopImpersonation } =
    useSyncedSession()
  const previewShopId = resolveActiveShopId(me, shopImpersonation)

  const [catalogTitle, setCatalogTitle] = useState('')
  const [catalogSubtitle, setCatalogSubtitle] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [accentColor, setAccentColor] = useState('#fbbf24')
  const [storefrontUrl, setStorefrontUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await fetchMerchantStorefrontSettings()
      setCatalogTitle(row.catalog_title || '')
      setCatalogSubtitle(row.catalog_subtitle || '')
      setWelcomeMessage(row.welcome_message || '')
      setAccentColor(row.accent_color || '#fbbf24')
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
        accent_color: accentColor.trim() || '#fbbf24',
      })
      setSaved(true)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (authPending) return <PageAuthLoading />

  if (showLogin) {
    return (
      <p className="text-slate-600 dark:text-slate-400">{t('dash.signIn')}</p>
    )
  }

  if (me && !me.online_storefront_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('onlineOrders.notEnabled')}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-violet-600 hover:underline">
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start gap-3">
        <Globe className="mt-1 h-8 w-8 shrink-0 text-violet-600 dark:text-violet-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('onlineShop.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('onlineShop.subtitle')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <form
          onSubmit={(e) => void save(e)}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('onlineShop.catalogTitle')}
            </label>
            <input
              value={catalogTitle}
              onChange={(e) => setCatalogTitle(e.target.value)}
              placeholder={t('onlineShop.catalogTitleHint')}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('onlineShop.catalogSubtitle')}
            </label>
            <input
              value={catalogSubtitle}
              onChange={(e) => setCatalogSubtitle(e.target.value)}
              placeholder={t('onlineShop.catalogSubtitleHint')}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('onlineShop.welcomeMessage')}
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
              placeholder={t('onlineShop.welcomeMessageHint')}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('onlineShop.accentColor')}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-transparent dark:border-slate-600"
              />
              <input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                dir="ltr"
                className="min-w-[8rem] flex-1 rounded-lg border px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {storefrontUrl ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('onlineShop.publicLink')}{' '}
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-violet-600 hover:underline dark:text-violet-400"
              >
                {storefrontUrl}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </p>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-300">{t('onlineShop.noHostYet')}</p>
          )}

          {import.meta.env.DEV ? (
            <p className="text-xs text-slate-500">
              {t('admin.storefrontLocalTest')}{' '}
              <Link
                to={previewShopId ? `/store/?shop_id=${previewShopId}` : '/store/'}
                className="font-mono text-violet-600 underline dark:text-violet-400"
              >
                /store/
              </Link>
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              {t('onlineShop.saved')}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? t('common.loading') : t('settings.save')}
          </button>
        </form>
      )}
    </div>
  )
}
