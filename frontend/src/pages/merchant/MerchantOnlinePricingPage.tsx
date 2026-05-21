import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  Percent,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageAuthLoading } from '../../components/PageAuthLoading'
import { UsdIqdDualInput } from '../../components/UsdIqdDualInput'
import { useLocale } from '../../context/LocaleContext'
import { useShopExchangeRate } from '../../hooks/useShopExchangeRate'
import { useSyncedSession } from '../../hooks/useSyncedSession'
import { apiJson, resolveMediaUrl } from '../../lib/api'
import { categoryDisplayName } from '../../lib/categoryNames'
import { formatMoney2, parseDec, usdToIqdString } from '../../lib/moneyInput'
import {
  fetchStorefrontDeliveryZones,
  saveStorefrontDeliveryZones,
  type DeliveryZoneDraft,
  type StorefrontDeliveryZoneRow,
} from '../../lib/merchantDeliveryZonesApi'
import {
  fetchOnlineProductPricing,
  patchOnlineProductPricing,
  type OnlineGalleryImage,
  type OnlineProductPricingRow,
} from '../../lib/merchantOnlinePricingApi'
import { OnlineProductContentEditor } from './OnlineProductContentEditor'

type RowDraft = {
  online_sale_price: string
  online_sale_price_iqd: string
  online_discount_percent: string
  online_discount_min_quantity: string
  online_description: string
}

function draftFromRow(row: OnlineProductPricingRow, rate: number | null): RowDraft {
  const usdRaw =
    row.online_sale_price != null && String(row.online_sale_price).trim() !== ''
      ? String(row.online_sale_price)
      : ''
  const usd = usdRaw ? formatMoney2(usdRaw) : ''
  const usdNum = parseDec(usd)
  const iqd =
    usd && rate != null && rate > 0 && usdNum > 0 ? usdToIqdString(usdNum, rate) : ''
  return {
    online_sale_price: usd,
    online_sale_price_iqd: iqd,
    online_discount_percent: formatMoney2(row.online_discount_percent ?? '0') || '0',
    online_discount_min_quantity: String(row.online_discount_min_quantity ?? 1),
    online_description: row.online_description ?? '',
  }
}

function displayUsdPrice(raw: string | null | undefined): string {
  const s = formatMoney2(raw)
  return s === '' ? '0' : s
}

type ZoneUiRow = DeliveryZoneDraft & { key: string }

function zoneDraftFromRow(row: StorefrontDeliveryZoneRow, rate: number | null): DeliveryZoneDraft {
  const usd = formatMoney2(row.delivery_fee_usd)
  const usdNum = parseDec(usd)
  const iqd =
    usd && rate != null && rate > 0 && usdNum > 0 ? usdToIqdString(usdNum, rate) : ''
  return {
    id: row.id,
    name: row.name,
    delivery_fee_usd: usd,
    delivery_fee_iqd: iqd,
    sort_order: row.sort_order,
    is_active: row.is_active,
  }
}

function zoneUiFromDraft(d: DeliveryZoneDraft, key: string): ZoneUiRow {
  return { ...d, key }
}

type CategoryOption = {
  id: number
  name_ku: string
  name_ar: string
  name_en: string
  name: string
}

export function MerchantOnlinePricingPage() {
  const { t, lang } = useLocale()
  const { me, authPending, showLogin, canAccessShopData, needsShop } = useSyncedSession()

  const [rows, setRows] = useState<OnlineProductPricingRow[]>([])
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilterId, setCategoryFilterId] = useState<number | null>(null)
  const [categories, setCategories] = useState<
    Array<{ id: number; name_ku: string; name_ar: string; name_en: string; name: string }>
  >([])

  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkMinQty, setBulkMinQty] = useState('1')
  const [usdLinked, setUsdLinked] = useState(true)
  const [iqdLinked, setIqdLinked] = useState(true)
  const [zones, setZones] = useState<ZoneUiRow[]>([])
  const [zonesLoading, setZonesLoading] = useState(true)
  const [zonesSaving, setZonesSaving] = useState(false)
  const [zoneCounter, setZoneCounter] = useState(0)
  const [freeDeliveryUsd, setFreeDeliveryUsd] = useState('')
  const [freeDeliveryIqd, setFreeDeliveryIqd] = useState('')
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const { rate } = useShopExchangeRate(canAccessShopData)

  const contentLabels = useMemo(
    () => ({
      description: t('onlinePricing.description'),
      descriptionHint: t('onlinePricing.descriptionHint'),
      gallery: t('onlinePricing.gallery'),
      galleryHint: t('onlinePricing.galleryHint'),
      addImage: t('onlinePricing.addGalleryImage'),
      removeImage: t('onlinePricing.removeGalleryImage'),
      uploading: t('common.loading'),
      galleryMax: t('onlinePricing.galleryMax'),
    }),
    [t],
  )

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

  const loadZones = useCallback(async () => {
    setZonesLoading(true)
    try {
      const data = await fetchStorefrontDeliveryZones()
      setZones(
        data.zones.map((r, i) =>
          zoneUiFromDraft(zoneDraftFromRow(r, rate), String(r.id ?? `z-${i}`)),
        ),
      )
      const raw = data.delivery_free_min_usd
      const usd = raw ? formatMoney2(raw) : ''
      const usdNum = parseDec(usd)
      const iqd =
        usd && rate != null && rate > 0 && usdNum > 0 ? usdToIqdString(usdNum, rate) : ''
      setFreeDeliveryUsd(usd)
      setFreeDeliveryIqd(iqd)
    } catch {
      setZones([])
      setFreeDeliveryUsd('')
      setFreeDeliveryIqd('')
    } finally {
      setZonesLoading(false)
    }
  }, [rate])

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiJson<CategoryOption[] | { results: CategoryOption[] }>(
        '/api/categories/',
        { shopScoped: true },
      )
      const list = Array.isArray(data) ? data : (data.results ?? [])
      setCategories(list)
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    if (canAccessShopData) void load()
  }, [canAccessShopData, load])

  useEffect(() => {
    if (canAccessShopData) void loadCategories()
  }, [canAccessShopData, loadCategories])

  useEffect(() => {
    if (canAccessShopData) void loadZones()
  }, [canAccessShopData, loadZones])

  useEffect(() => {
    if (!saved) return
    const id = window.setTimeout(() => setSaved(false), 3000)
    return () => window.clearTimeout(id)
  }, [saved])

  const filtered = useMemo(() => {
    let list = rows
    if (categoryFilterId != null) {
      list = list.filter((r) => r.category_id === categoryFilterId)
    }
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.category_name.toLowerCase().includes(q),
    )
  }, [rows, search, categoryFilterId])

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

  function updateRowGallery(productId: number, images: OnlineGalleryImage[]) {
    setRows((prev) =>
      prev.map((r) => (r.id === productId ? { ...r, gallery_images: images } : r)),
    )
  }

  function setPriceDraft(id: number, usd: string, iqd: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], online_sale_price: usd, online_sale_price_iqd: iqd },
    }))
  }

  function addZone() {
    const key = `new-${zoneCounter}`
    setZoneCounter((c) => c + 1)
    setZones((prev) => [
      ...prev,
      zoneUiFromDraft(
        {
          name: '',
          delivery_fee_usd: '',
          delivery_fee_iqd: '',
          sort_order: prev.length,
          is_active: true,
        },
        key,
      ),
    ])
  }

  function removeZone(key: string) {
    setZones((prev) => prev.filter((z) => z.key !== key))
  }

  function setZoneDraft(key: string, patch: Partial<DeliveryZoneDraft>) {
    setZones((prev) => prev.map((z) => (z.key === key ? { ...z, ...patch } : z)))
  }

  function setZoneFee(key: string, usd: string, iqd: string) {
    setZoneDraft(key, { delivery_fee_usd: usd, delivery_fee_iqd: iqd })
  }

  async function saveZones() {
    setZonesSaving(true)
    setError(null)
    try {
      const payload = zones
        .filter((z) => z.name.trim() !== '')
        .map((z, idx) => ({
          ...(z.id != null ? { id: z.id } : {}),
          name: z.name.trim(),
          delivery_fee_usd: formatMoney2(z.delivery_fee_usd.trim() || '0') || '0',
          sort_order: idx,
          is_active: z.is_active,
        }))
      const freeMin =
        freeDeliveryUsd.trim() === '' ? null : formatMoney2(freeDeliveryUsd.trim()) || null
      const updated = await saveStorefrontDeliveryZones(payload, freeMin)
      setZones(
        updated.zones.map((r, i) =>
          zoneUiFromDraft(zoneDraftFromRow(r, rate), String(r.id ?? `z-${i}`)),
        ),
      )
      const raw = updated.delivery_free_min_usd
      const usd = raw ? formatMoney2(raw) : ''
      const usdNum = parseDec(usd)
      const iqd =
        usd && rate != null && rate > 0 && usdNum > 0 ? usdToIqdString(usdNum, rate) : ''
      setFreeDeliveryUsd(usd)
      setFreeDeliveryIqd(iqd)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setZonesSaving(false)
    }
  }

  async function saveAll() {
    setSaving(true)
    setError(null)
    try {
      const items = rows.map((r) => {
        const d = drafts[r.id] ?? draftFromRow(r, rate)
        return {
          id: r.id,
          online_sale_price:
            d.online_sale_price.trim() === '' ? null : formatMoney2(d.online_sale_price.trim()),
          online_discount_percent: formatMoney2(d.online_discount_percent.trim() || '0') || '0',
          online_discount_min_quantity: Math.max(
            1,
            Number.parseInt(d.online_discount_min_quantity, 10) || 1,
          ),
          online_description: d.online_description.trim(),
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

      <section className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-5 dark:border-teal-900/40 dark:bg-teal-950/20">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <MapPin className="h-4 w-4 text-teal-600" aria-hidden />
          {t('onlinePricing.deliveryZones')}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t('onlinePricing.deliveryZonesHint')}
        </p>

        <div className="mt-4 rounded-xl border border-teal-200/60 bg-white p-4 dark:border-teal-900/40 dark:bg-slate-900">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {t('onlinePricing.freeDelivery')}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{t('onlinePricing.freeDeliveryHint')}</p>
          <div className="mt-3 max-w-md">
            <p className="mb-1 text-xs font-medium text-slate-500">
              {t('onlinePricing.freeDeliveryMin')}
            </p>
            <UsdIqdDualInput
              compact
              usdLabel={t('onlinePricing.priceUsd')}
              iqdLabel={t('onlinePricing.priceIqd')}
              usdValue={freeDeliveryUsd}
              iqdValue={freeDeliveryIqd}
              onUsdChange={(usd, iqd) => {
                setFreeDeliveryUsd(usd)
                setFreeDeliveryIqd(iqd)
              }}
              onIqdChange={(iqd, usd) => {
                setFreeDeliveryIqd(iqd)
                setFreeDeliveryUsd(usd)
              }}
              usdLinked={usdLinked}
              iqdLinked={iqdLinked}
              onToggleUsdLink={() => setUsdLinked((v) => !v)}
              onToggleIqdLink={() => setIqdLinked((v) => !v)}
              rate={rate}
              usdPlaceholder="50"
              linkActiveTitle={linkTitles.active}
              linkInactiveTitle={linkTitles.inactive}
            />
          </div>
        </div>

        {zonesLoading ? (
          <div className="mt-4 flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" aria-hidden />
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {zones.map((zone) => (
              <li
                key={zone.key}
                className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-end"
              >
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    {t('onlinePricing.zoneName')}
                  </span>
                  <input
                    type="text"
                    value={zone.name}
                    onChange={(e) => setZoneDraft(zone.key, { name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                    placeholder={t('onlinePricing.zoneName')}
                  />
                </label>
                <div className="min-w-[240px] flex-1">
                  <p className="mb-1 text-xs font-medium text-slate-500">{t('onlinePricing.zoneFee')}</p>
                  <UsdIqdDualInput
                    compact
                    usdLabel={t('onlinePricing.priceUsd')}
                    iqdLabel={t('onlinePricing.priceIqd')}
                    usdValue={zone.delivery_fee_usd}
                    iqdValue={zone.delivery_fee_iqd}
                    onUsdChange={(usd, iqd) => setZoneFee(zone.key, usd, iqd)}
                    onIqdChange={(iqd, usd) => setZoneFee(zone.key, usd, iqd)}
                    usdLinked={usdLinked}
                    iqdLinked={iqdLinked}
                    onToggleUsdLink={() => setUsdLinked((v) => !v)}
                    onToggleIqdLink={() => setIqdLinked((v) => !v)}
                    rate={rate}
                    usdPlaceholder="0"
                    linkActiveTitle={linkTitles.active}
                    linkInactiveTitle={linkTitles.inactive}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeZone(zone.key)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('onlinePricing.removeZone')}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addZone}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-4 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('onlinePricing.addZone')}
          </button>
          <button
            type="button"
            disabled={zonesSaving || zonesLoading}
            onClick={() => void saveZones()}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {zonesSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {t('onlinePricing.saveZones')}
          </button>
        </div>
      </section>

      <div className="space-y-3">
        {categories.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('onlinePricing.filterCategory')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilterId(null)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  categoryFilterId === null
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {t('onlinePricing.allCategories')}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilterId(cat.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    categoryFilterId === cat.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {categoryDisplayName(cat, lang)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

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
            <table className="w-full min-w-[960px] text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3">{t('onlinePricing.colProduct')}</th>
                  <th className="px-4 py-3">{t('onlinePricing.colContent')}</th>
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
                  const expanded = expandedProductId === row.id
                  return (
                    <Fragment key={row.id}>
                    <tr
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
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProductId((id) => (id === row.id ? null : row.id))
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          {expanded ? t('onlinePricing.hideContent') : t('onlinePricing.editContent')}
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-500">
                        ${displayUsdPrice(row.sale_price_retail)}
                      </td>
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
                          usdPlaceholder={displayUsdPrice(row.sale_price_retail)}
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
                        ${displayUsdPrice(row.effective_price)}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30">
                        <td colSpan={7} className="px-4 py-4">
                          <OnlineProductContentEditor
                            productId={row.id}
                            description={d.online_description}
                            galleryImages={row.gallery_images ?? []}
                            labels={contentLabels}
                            onDescriptionChange={(value) =>
                              setDraft(row.id, { online_description: value })
                            }
                            onGalleryChange={(images) => updateRowGallery(row.id, images)}
                            onError={(msg) => setError(msg)}
                          />
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {filtered.map((row) => {
              const d = drafts[row.id] ?? draftFromRow(row, rate)
              const expanded = expandedProductId === row.id
              return (
                <li key={row.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">{row.name}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProductId((id) => (id === row.id ? null : row.id))
                      }
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                    >
                      <FileText className="h-3 w-3" aria-hidden />
                      {expanded ? t('onlinePricing.hideContent') : t('onlinePricing.editContent')}
                    </button>
                  </div>
                  {expanded ? (
                    <OnlineProductContentEditor
                      productId={row.id}
                      description={d.online_description}
                      galleryImages={row.gallery_images ?? []}
                      labels={contentLabels}
                      onDescriptionChange={(value) =>
                        setDraft(row.id, { online_description: value })
                      }
                      onGalleryChange={(images) => updateRowGallery(row.id, images)}
                      onError={(msg) => setError(msg)}
                    />
                  ) : null}
                  <p className="text-xs text-slate-500">
                    {t('onlinePricing.colRetail')}: ${displayUsdPrice(row.sale_price_retail)}
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
                      usdPlaceholder={displayUsdPrice(row.sale_price_retail)}
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
