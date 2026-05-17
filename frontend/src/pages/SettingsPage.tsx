import { CheckCircle2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SettingsAppearanceSection } from '../components/settings/SettingsAppearanceSection'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { useTheme } from '../context/ThemeContext'
import { apiJson, getSuperuserShopId, setSuperuserShopId } from '../lib/api'
import { setShowIqdOnPdf, withReceiptPrefs } from '../lib/receiptPrefs'
import {
  THEME_PALETTE_DEFAULTS,
  paletteFromShopSettings,
  shopThemePatchFromPalette,
} from '../lib/themeColors'
import type { CurrencyRow, ReceiptSettingsRow, ShopRow, ShopSettingsRow } from '../types/api'

export function SettingsPage() {
  const { t } = useLocale()
  const { me, loading } = useSession()
  const { applyTheme, mode, resolvedMode } = useTheme()
  const [shop, setShop] = useState<ShopRow | null>(null)
  const [shopSettings, setShopSettings] = useState<ShopSettingsRow | null>(null)
  const [receipt, setReceipt] = useState<ReceiptSettingsRow | null>(null)
  const [receiptLogo, setReceiptLogo] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingRate, setSavingRate] = useState(false)
  const [ratePer100Input, setRatePer100Input] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [receiptQrPreview, setReceiptQrPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(null), 2800)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  const load = useCallback(async () => {
    try {
      setError(null)
      if (me?.is_superuser) {
        const sid = localStorage.getItem('pos_shop_id')?.trim()
        if (sid) setSuperuserShopId(sid)
      }
      const shops = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/')
      const list = Array.isArray(shops) ? shops : shops.results
      const s0 = list[0]
      setShop(s0 ?? null)
      if (!s0) {
        setShopSettings(null)
        setReceipt(null)
        return
      }
      if (me?.is_superuser && !getSuperuserShopId()) {
        const fallback = String(s0.id)
        localStorage.setItem('pos_shop_id', fallback)
        setSuperuserShopId(fallback)
      }
      const [ss, rs] = await Promise.all([
        apiJson<ShopSettingsRow>('/api/shop-settings/', { shopScoped: true }),
        apiJson<ReceiptSettingsRow>('/api/receipt-settings/', { shopScoped: true }),
      ])
      const rateRows = await apiJson<CurrencyRow[]>('/api/currencies/', {
        shopScoped: true,
      })
      const latestRate = [...rateRows].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0]
      if (latestRate) {
        setRatePer100Input(String(Math.round(parseFloat(latestRate.usd_to_iqd) * 100)))
      } else {
        setRatePer100Input('')
      }
      setShopSettings(ss)
      applyTheme({
        ...paletteFromShopSettings(ss),
        mode: ss.default_mode === 'system' ? 'light' : ss.default_mode,
      })
      setReceipt(withReceiptPrefs(rs))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [applyTheme, me, t])

  useEffect(() => {
    if (me) void load()
  }, [me, load])

  async function saveAll() {
    if (!shopSettings || !receipt || !shop) return
    setSaving(true)
    setError(null)
    try {
      const settingsPromise = apiJson<ShopSettingsRow>('/api/shop-settings/', {
        method: 'PATCH',
        shopScoped: true,
        body: JSON.stringify({
          base_currency: shopSettings.base_currency,
          default_mode: shopSettings.default_mode,
          ...shopThemePatchFromPalette(paletteFromShopSettings(shopSettings)),
        }),
      })
      const form = new FormData()
      form.append('shop_name_en', receipt.shop_name_en)
      form.append('shop_name_ku', receipt.shop_name_ku)
      form.append('sub_title', receipt.sub_title)
      form.append('address', receipt.address)
      form.append('receipt_qr_url', (receipt.receipt_qr_url ?? '').trim())
      form.append('receipt_qr_caption', (receipt.receipt_qr_caption ?? '').trim().slice(0, 500))
      form.append('phone_number', receipt.phone_number)
      form.append('email', receipt.email)
      form.append('footer_note', receipt.footer_note)
      form.append('direct_print', receipt.direct_print ? 'true' : 'false')
      form.append('show_customer_balance', receipt.show_customer_balance ? 'true' : 'false')
      form.append('show_item_images', receipt.show_item_images ? 'true' : 'false')
      form.append('receipt_format', receipt.receipt_format)
      if (receiptLogo) form.append('logo', receiptLogo)
      const [nextSettings, nextReceipt] = await Promise.all([
        settingsPromise,
        apiJson<ReceiptSettingsRow>('/api/receipt-settings/', {
          method: 'PUT',
          shopScoped: true,
          body: form,
        }),
      ])
      setShopSettings(nextSettings)
      applyTheme({
        ...paletteFromShopSettings(nextSettings),
        mode:
          nextSettings.default_mode === 'system' ? mode : nextSettings.default_mode,
      })
      setShowIqdOnPdf(nextReceipt.shop, receipt.show_iqd_on_pdf !== false)
      setReceipt(withReceiptPrefs(nextReceipt))
      setReceiptLogo(null)
      setSuccessMessage(t('settings.saveSuccess'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function saveRate() {
    const normalized = ratePer100Input.replace(/[,\u066C،\s]/g, '').trim()
    const parsed = Number.parseFloat(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('inv.saveRateFailed'))
      return
    }
    setSavingRate(true)
    setError(null)
    try {
      await apiJson<CurrencyRow>('/api/currencies/set-today/', {
        method: 'POST',
        shopScoped: true,
        body: JSON.stringify({ usd_to_iqd: String(parsed / 100) }),
      })
      setSuccessMessage(t('settings.rateSaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('inv.saveRateFailed'))
    } finally {
      setSavingRate(false)
    }
  }

  const receiptPreviewLines = useMemo(() => {
    if (!receipt) return []
    return [
      receipt.shop_name_ku || 'ناوی دوکان',
      receipt.shop_name_en || 'Shop Name',
      receipt.sub_title || '',
      receipt.address || '',
      `${receipt.phone_number || ''} ${receipt.email || ''}`.trim(),
      receipt.footer_note || '',
    ].filter(Boolean)
  }, [receipt])

  useEffect(() => {
    const u = (receipt?.receipt_qr_url ?? '').trim()
    if (!u) {
      setReceiptQrPreview(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(u, { width: 96, margin: 0, errorCorrectionLevel: 'M' })
      .then((dataUrl) => {
        if (!cancelled) setReceiptQrPreview(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setReceiptQrPreview(null)
      })
    return () => {
      cancelled = true
    }
  }, [receipt?.receipt_qr_url])

  const previewPalette = useMemo(
    () => (shopSettings ? paletteFromShopSettings(shopSettings) : THEME_PALETTE_DEFAULTS),
    [shopSettings],
  )

  const patchThemeField = useCallback(
    (patch: Partial<ShopSettingsRow>) => {
      setShopSettings((s) => {
        if (!s) return s
        const next = { ...s, ...patch }
        applyTheme({
          ...paletteFromShopSettings(next),
          mode:
            next.default_mode === 'system'
              ? mode
              : (next.default_mode as 'light' | 'dark'),
        })
        return next
      })
    },
    [applyTheme, mode],
  )

  function resetThemeColors() {
    const d = THEME_PALETTE_DEFAULTS
    patchThemeField({
      primary_color: d.primaryColor,
      background_color: d.backgroundColor,
      dark_background_color: d.darkBackgroundColor,
      accent_color: d.accentColor,
      sidebar_color: d.sidebarColor,
      surface_color: d.surfaceColor,
      surface_color_dark: d.surfaceColorDark,
      success_color: d.successColor,
      warning_color: d.warningColor,
      danger_color: d.dangerColor,
    })
  }

  if (loading) return <div className="p-8 text-center text-slate-500">{t('common.loading')}</div>
  if (!me) return <div className="p-8 text-red-600">{t('common.loginFailed')}</div>
  if (
    !me.is_superuser &&
    me.role !== 'employee' &&
    me.role !== 'owner' &&
    me.role !== 'manager' &&
    me.role !== 'receipt_editor'
  ) {
    return <div className="p-8 text-red-600">{t('settings.accessDenied')}</div>
  }
  if (!shop || !shopSettings || !receipt) {
    if (error) {
      return <div className="p-8 text-red-600">{error}</div>
    }
    return <div className="p-8 text-slate-700">{t('settings.noShop')}</div>
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-900 dark:text-slate-100">
      {successMessage ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto flex min-w-[260px] max-w-md items-center gap-2 rounded-2xl border border-emerald-200 bg-white/95 px-3 py-3 text-sm font-medium text-emerald-800 shadow-lg ring-1 ring-emerald-100 backdrop-blur animate-in fade-in slide-in-from-top-2 duration-300 dark:border-emerald-800 dark:bg-slate-900/95 dark:text-emerald-100 dark:ring-emerald-900/60"
          >
            <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            </span>
            <p className="flex-1">{successMessage}</p>
            <span className="h-1 w-14 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/60">
              <span className="block h-full w-full origin-left animate-[shrink_2.8s_linear_forwards] rounded-full bg-emerald-500 dark:bg-emerald-300" />
            </span>
          </div>
        </div>
      ) : null}
      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.settings')}</h1>
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? t('inv.saving') : t('settings.save')}
        </button>
      </div>
      {error ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <SettingsAppearanceSection
          t={t}
          shopSettings={shopSettings}
          previewPalette={previewPalette}
          resolvedMode={resolvedMode}
          mode={mode}
          onPatch={patchThemeField}
          onModeChange={(v) => {
            patchThemeField({ default_mode: v })
            applyTheme({ mode: v })
          }}
          onReset={resetThemeColors}
        />
<section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:col-span-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('settings.baseCurrency')}</h2>
          <select
            value={shopSettings.base_currency}
            onChange={(e) =>
              setShopSettings((s) => (s ? { ...s, base_currency: e.target.value as 'USD' | 'IQD' } : s))
            }
            className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="USD">USD</option>
            <option value="IQD">IQD</option>
          </select>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:col-span-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('settings.rateTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('inv.rateDialogHint')}</p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={ratePer100Input}
              onChange={(e) => setRatePer100Input(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 tabular-nums dark:border-slate-600 dark:bg-slate-900"
              placeholder={t('inv.ratePlaceholder')}
            />
            <button
              type="button"
              onClick={() => void saveRate()}
              disabled={savingRate}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {savingRate ? t('inv.saving') : t('inv.save')}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:col-span-7">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('settings.receiptTitle')}</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">{t('settings.receiptLogo')}</span>
              <input type="file" accept="image/*" onChange={(e) => setReceiptLogo(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
            </label>
            <input value={receipt.shop_name_en} onChange={(e) => setReceipt((r) => (r ? { ...r, shop_name_en: e.target.value } : r))} placeholder={t('settings.receiptShopNameEn')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" />
            <input value={receipt.shop_name_ku} onChange={(e) => setReceipt((r) => (r ? { ...r, shop_name_ku: e.target.value } : r))} placeholder={t('settings.receiptShopNameKu')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" />
            <input value={receipt.sub_title} onChange={(e) => setReceipt((r) => (r ? { ...r, sub_title: e.target.value } : r))} placeholder={t('settings.receiptSubTitle')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 sm:col-span-2" />
            <input value={receipt.address} onChange={(e) => setReceipt((r) => (r ? { ...r, address: e.target.value } : r))} placeholder={t('settings.receiptAddress')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 sm:col-span-2" />
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">{t('settings.receiptQrUrl')}</span>
              <input
                value={receipt.receipt_qr_url ?? ''}
                onChange={(e) => setReceipt((r) => (r ? { ...r, receipt_qr_url: e.target.value } : r))}
                dir="auto"
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
              <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{t('settings.receiptQrUrlHint')}</span>
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-600 dark:text-slate-300">{t('settings.receiptQrCaption')}</span>
              <textarea
                value={receipt.receipt_qr_caption ?? ''}
                onChange={(e) => setReceipt((r) => (r ? { ...r, receipt_qr_caption: e.target.value.slice(0, 500) } : r))}
                dir="auto"
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              />
              <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{t('settings.receiptQrCaptionHint')}</span>
            </label>
            <input value={receipt.phone_number} onChange={(e) => setReceipt((r) => (r ? { ...r, phone_number: e.target.value } : r))} placeholder={t('settings.receiptPhone')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" />
            <input value={receipt.email} onChange={(e) => setReceipt((r) => (r ? { ...r, email: e.target.value } : r))} placeholder={t('settings.receiptEmail')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900" />
            <textarea value={receipt.footer_note} onChange={(e) => setReceipt((r) => (r ? { ...r, footer_note: e.target.value } : r))} placeholder={t('settings.receiptFooter')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900 sm:col-span-2" rows={2} />
            <label className="flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                checked={receipt.show_customer_balance}
                onChange={(e) => setReceipt((r) => (r ? { ...r, show_customer_balance: e.target.checked } : r))}
              />
              <span>{t('settings.showCustomerBalance')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-1">
              <input
                type="checkbox"
                checked={receipt.show_item_images}
                onChange={(e) => setReceipt((r) => (r ? { ...r, show_item_images: e.target.checked } : r))}
              />
              <span>{t('settings.showItemImages')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={receipt.show_iqd_on_pdf !== false}
                onChange={(e) => setReceipt((r) => (r ? { ...r, show_iqd_on_pdf: e.target.checked } : r))}
              />
              <span>{t('settings.showIqdOnPdf')}</span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:col-span-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('settings.livePreview')}</h2>
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm dark:border-slate-600 dark:bg-slate-900/60">
            {receipt.logo_url ? <img src={receipt.logo_url} alt="" className="mx-auto mb-2 h-14 w-14 rounded object-cover" /> : null}
            {receiptPreviewLines.map((line, idx) => (
              <p key={`${line}-${idx}`} className={idx === 0 ? 'font-semibold' : 'text-slate-600 dark:text-slate-300'}>
                {line}
              </p>
            ))}
            {receiptQrPreview ? (
              <div className="mt-2 flex justify-start">
                <div className="w-fit max-w-[110px] text-start">
                  {(receipt.receipt_qr_caption ?? '').trim() ? (
                    <p className="mb-1 text-[10px] font-semibold leading-snug text-slate-700 dark:text-slate-300">
                      {(receipt.receipt_qr_caption ?? '').trim()}
                    </p>
                  ) : null}
                  <img
                    src={receiptQrPreview}
                    width={88}
                    height={88}
                    className="block h-[88px] w-[88px]"
                    alt="QR"
                  />
                </div>
              </div>
            ) : null}
            <hr className="my-3 border-slate-300 dark:border-slate-600" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Item 1 x 2 .... 50.00</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Item 2 x 1 .... 20.00</p>
          </div>
        </section>
      </div>
    </div>
  )
}
