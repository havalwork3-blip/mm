import { DollarSign, Loader2, Percent, RefreshCw, Save, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageAuthLoading } from '../../components/PageAuthLoading'
import { UsdIqdDualInput } from '../../components/UsdIqdDualInput'
import { useLocale } from '../../context/LocaleContext'
import { useShopExchangeRate } from '../../hooks/useShopExchangeRate'
import { useSyncedSession } from '../../hooks/useSyncedSession'
import { resolveMediaUrl } from '../../lib/api'
import { parseDec, usdToIqdString } from '../../lib/moneyInput'
import {
  fetchOnlineProductPricing,
  patchOnlineProductPricing,
  type OnlineProductPricingRow,
} from '../../lib/merchantOnlinePricingApi'

type RowDraft = {
  online_sale_price: string
  online_sale_price_iqd: string
  online_discount_percent: string
  online_discount_min_quantity: string
}

function draftFromRow(row: OnlineProductPricingRow, rate: number | null): RowDraft {
  const usd =
    row.online_sale_price != null && String(row.online_sale_price).trim() !== ''
      ? String(row.online_sale_price)
      : ''
  const usdNum = parseDec(usd)
  const iqd =
    usd && rate != null && rate > 0 && usdNum > 0 ? usdToIqdString(usdNum, rate) : ''
  return {
    online_sale_price: usd,
    online_sale_price_iqd: iqd,
    online_discount_percent: String(row.online_discount_percent ?? '0'),
    online_discount_min_quantity: String(row.online_discount_min_quantity ?? 1),
  }
}

export function MerchantOnlinePricingPage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, canAccessShopData, needsShop } = useSyncedSession()

  const [rows, setRows] = useState<OnlineProductPricingRow[]>([])
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')

  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkMinQty, setBulkMinQty] = useState('1')
  const [usdLinked, setUsdLinked] = useState(true)
  const [iqdLinked, setIqdLinked] = useState(true)
  const { rate } = useShopExchangeRate(canAccessShopData)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOnlineProductPricing()
      setRows(data)
      const next: Record<number, RowDraft> = {}
      for (const r of data) next[r.id] = draftFromRow(r, rate)
      setDrafts(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [t, rate])

  useEffect(() => {
    if (canAccessShopData) void load()
  }, [canAccessShopData, load])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(id)
  }, [saved])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q),
    )
  }, [rows, search])

  function setDraft(id: number, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }))
  }

  async function applyBulkDiscount() {
    const pct = bulkPercent.trim()
    const minQty = bulkMinQty.trim()
    if (!pct) return
    setSaving(true)
    setError(null)
    try {
      const updated = await patchOnlineProductPricing({
        bulk_discount: {
          online_discount_percent: pct,
          online_discount_min_quantity: Math.max(1, Number.parseInt(minQty, 10) || 1),
        },
      })
      setRows(updated)
      const next: Record<number, RowDraft> = {}
      for (const r of updated) next[r.id] = draftFromRow(r, rate)
      setDrafts(next)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function setPriceDraft(id: number, usd: string, iqd: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], online_sale_price: usd, online_sale_price_iqd: iqd },
    }))
  }

  async function saveAll() {
    setSaving(true)
    setError(null)
    try {
      const items = rows.map((r) => {
        const d = drafts[r.id] ?? draftFromRow(r, rate)
        return {
          id: r.id,
          online_sale_price: d.online_sale_price.trim() === '' ? null : d.online_sale_price.trim(),
          online_discount_percent: d.online_discount_percent.trim() || '0',
          online_discount_min_quantity: Math.max(
            1,
            Number.parseInt(d.online_discount_min_quantity, 10) || 1,
          ),
        }
      })
      const updated = await patchOnlineProductPricing({ items })
      setRows(updated)
      const next: Record<number, RowDraft> = {}
      for (const r of updated) next[r.id] = draftFromRow(r, rate)
      setDrafts(next)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const linkTitles = {
    active: t('pos.usdLinkActiveTitle'),
    inactive: t('pos.usdLinkInactiveTitle'),
  }

  if (authPending) return <PageAuthLoading />

  if (showLogin) {
    return <p className="text-slate-600 dark:text-slate-400">{t('dash.signIn')}</p>
  }

  if (me && !me.online_storefront_enabled) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('onlineOrders.notEnabled')}</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-violet-600">
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
    <div className="mx-auto w-full max-w-[100%] space-y-6 px-4 pb-10 sm:px-6 md:max-w-6xl md:px-8 xl:max-w-7xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-500 to-cyan-500 p-6 text-white shadow-lg sm:p-8">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              {t('onlinePricing.badge')}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t('onlinePricing.title')}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/90">{t('onlinePricing.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              {t('onlineOrders.refresh')}
            </button>
            <Link
              to="/online-shop"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-md"
            >
              {t('nav.onlineShop')}
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-violet-200/80 bg-violet-50/50 p-5 dark:border-violet-900/40 dark:bg-violet-950/20">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Percent className="h-4 w-4 text-violet-600" aria-hidden />
          {t('onlinePricing.bulkDiscount')}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t('onlinePricing.bulkDiscountHint')}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              {t('onlinePricing.discountPercent')}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={bulkPercent}
              onChange={(e) => setBulkPercent(e.target.value)}
              className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              placeholder="10"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              {t('onlinePricing.minQty')}
            </span>
            <input
              type="number"
              min={1}
              value={bulkMinQty}
              onChange={(e) => setBulkMinQty(e.target.value)}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <button
            type="button"
            disabled={saving || !bulkPercent.trim()}
            onClick={() => void applyBulkDiscount()}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {t('onlinePricing.applyToAll')}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('onlinePricing.search')}
          className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {saving ? t('common.loading') : t('settings.save')}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t('onlineShop.saved')}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3">{t('onlinePricing.colProduct')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.colRetail')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.colOnlinePrice')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.discountPercent')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.minQty')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.colEffective')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const d = drafts[row.id] ?? draftFromRow(row, rate)
                  const img = resolveMediaUrl(row.image_url)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-50 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {img ? (
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-slate-300">
                                <DollarSign className="h-4 w-4" aria-hidden />
                              </span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                            <p className="text-xs text-slate-500">{row.category_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">${row.sale_price_retail}</td>
                      <td className="min-w-[280px] px-4 py-3">
                        <UsdIqdDualInput
                          compact
                          usdLabel={t('onlinePricing.priceUsd')}
                          iqdLabel={t('onlinePricing.priceIqd')}
                          usdValue={d.online_sale_price}
                          iqdValue={d.online_sale_price_iqd}
                          onUsdChange={(usd, iqd) => setPriceDraft(row.id, usd, iqd)}
                          onIqdChange={(iqd, usd) => setPriceDraft(row.id, usd, iqd)}
                          usdLinked={usdLinked}
                          iqdLinked={iqdLinked}
                          onToggleUsdLink={() => setUsdLinked((v) => !v)}
                          onToggleIqdLink={() => setIqdLinked((v) => !v)}
                          rate={rate}
                          usdPlaceholder={row.sale_price_retail}
                          linkActiveTitle={linkTitles.active}
                          linkInactiveTitle={linkTitles.inactive}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={d.online_discount_percent}
                          onChange={(e) =>
                            setDraft(row.id, { online_discount_percent: e.target.value })
                          }
                          className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={d.online_discount_min_quantity}
                          onChange={(e) =>
                            setDraft(row.id, { online_discount_min_quantity: e.target.value })
                          }
                          className="w-16 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        ${row.effective_price}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {filtered.map((row) => {
              const d = drafts[row.id] ?? draftFromRow(row, rate)
              return (
                <li key={row.id} className="space-y-3 p-4">
                  <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-slate-500">
                    {t('onlinePricing.colRetail')}: ${row.sale_price_retail}
                  </p>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      {t('onlinePricing.colOnlinePrice')}
                    </p>
                    <UsdIqdDualInput
                      usdLabel={t('onlinePricing.priceUsd')}
                      iqdLabel={t('onlinePricing.priceIqd')}
                      usdValue={d.online_sale_price}
                      iqdValue={d.online_sale_price_iqd}
                      onUsdChange={(usd, iqd) => setPriceDraft(row.id, usd, iqd)}
                      onIqdChange={(iqd, usd) => setPriceDraft(row.id, usd, iqd)}
                      usdLinked={usdLinked}
                      iqdLinked={iqdLinked}
                      onToggleUsdLink={() => setUsdLinked((v) => !v)}
                      onToggleIqdLink={() => setIqdLinked((v) => !v)}
                      rate={rate}
                      usdPlaceholder={row.sale_price_retail}
                      linkActiveTitle={linkTitles.active}
                      linkInactiveTitle={linkTitles.inactive}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-medium text-slate-500">
                      {t('onlinePricing.discountPercent')}
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={d.online_discount_percent}
                        onChange={(e) =>
                          setDraft(row.id, { online_discount_percent: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      {t('onlinePricing.minQty')}
                      <input
                        type="number"
                        min={1}
                        value={d.online_discount_min_quantity}
                        onChange={(e) =>
                          setDraft(row.id, { online_discount_min_quantity: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                      />
                    </label>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
