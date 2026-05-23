import { ArrowDown, ArrowUp, Loader2, Palette, RotateCcw, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { resolveMediaUrl } from '../../lib/api'
import { categoryDisplayName } from '../../lib/categoryNames'
import {
  fetchMerchantStorefrontCategoryCards,
  patchMerchantStorefrontCategoryCards,
  type MerchantStorefrontCategoryCard,
} from '../../lib/merchantStorefrontCategoriesApi'
import {
  categoriesUseClassicPanel,
  categoryCardGradient,
  presetMatchesCategory,
  resolveCategoriesSectionGradient,
  STOREFRONT_CATEGORY_BG_PRESETS,
} from '../storefront/storefrontCategoryCardTheme'
import { sectionPanelGradient } from '../storefront/storefrontSectionTheme'

type Row = MerchantStorefrontCategoryCard & { _key: string }

function toRows(data: MerchantStorefrontCategoryCard[]): Row[] {
  const withProducts = data.filter((c) => c.product_count > 0)
  const sorted = [...withProducts].sort((a, b) => {
    const ao = a.storefront_home_order
    const bo = b.storefront_home_order
    const aHas = ao != null
    const bHas = bo != null
    if (aHas && bHas) return ao! - bo!
    if (aHas) return -1
    if (bHas) return 1
    return (a.name_ku || '').localeCompare(b.name_ku || '', undefined, { sensitivity: 'base' })
  })
  return sorted.map((c) => ({ ...c, _key: String(c.id) }))
}

export function MerchantStorefrontCategoryCardsSection() {
  const { t, lang } = useLocale()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const hasCustomColors = useMemo(() => !categoriesUseClassicPanel(rows), [rows])

  const previewGradient = useMemo(() => {
    if (rows.length === 0) return sectionPanelGradient('categories')
    const asCatalog = rows.map(
      (r) =>
        ({
          id: r.id,
          name_ku: r.name_ku,
          name: r.name_ku,
          storefront_bg_from: r.storefront_bg_from,
          storefront_bg_to: r.storefront_bg_to,
          storefront_home_order: r.storefront_home_order,
          products: Array.from({ length: r.product_count }),
        }) as import('../../api/storefrontApi').PublicStorefrontCategory,
    )
    return resolveCategoriesSectionGradient(asCatalog) ?? sectionPanelGradient('categories')
  }, [rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMerchantStorefrontCategoryCards()
      setRows(toRows(data))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const empty = useMemo(() => rows.length === 0 && !loading, [rows.length, loading])

  function moveRow(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= rows.length) return
    setRows((prev) => {
      const copy = [...prev]
      const tmp = copy[index]
      copy[index] = copy[next]
      copy[next] = tmp
      return copy.map((r, i) => ({ ...r, storefront_home_order: i }))
    })
    setSaved(false)
  }

  function applyPreset(index: number, from: string, to: string) {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, storefront_bg_from: from, storefront_bg_to: to } : r,
      ),
    )
    setSaved(false)
  }

  function setColor(index: number, field: 'storefront_bg_from' | 'storefront_bg_to', value: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value || null } : r)),
    )
    setSaved(false)
  }

  function buildPatchItems(clearColors: boolean) {
    return rows.map((r, i) => ({
      id: r.id,
      storefront_home_order: i,
      storefront_bg_from: clearColors ? '' : r.storefront_bg_from || '',
      storefront_bg_to: clearColors ? '' : r.storefront_bg_to || '',
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const data = await patchMerchantStorefrontCategoryCards(buildPatchItems(false))
      setRows(toRows(data))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function handleResetColors() {
    setResetting(true)
    setError(null)
    setSaved(false)
    try {
      const data = await patchMerchantStorefrontCategoryCards(buildPatchItems(true))
      setRows(toRows(data))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setResetting(false)
    }
  }

  const busy = saving || resetting

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <Palette className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('onlineShop.categoryCardsTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('onlineShop.categoryCardsHint')}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t('common.loading')}
          </div>
        ) : empty ? (
          <p className="py-6 text-center text-sm text-slate-500">{t('onlineShop.categoryCardsEmpty')}</p>
        ) : (
          <>
            <div
              className={[
                'sf-section-panel relative overflow-hidden p-3',
                hasCustomColors
                  ? 'rounded-t-2xl'
                  : 'sf-section-panel--classic rounded-2xl shadow-md',
              ].join(' ')}
              style={{
                background: previewGradient,
                ...(hasCustomColors
                  ? {}
                  : { boxShadow: '0 10px 36px rgba(91, 33, 182, 0.16), 0 4px 14px rgba(15, 23, 42, 0.07)' }),
              }}
            >
              <span className="sf-section-panel-shine pointer-events-none absolute inset-0" aria-hidden />
              <p className="relative mb-2 text-[10px] font-bold text-white/90">
                {hasCustomColors
                  ? t('onlineShop.categoryCardsPreviewCustom')
                  : t('onlineShop.categoryCardsPreviewClassic')}
              </p>
              <div className="relative flex gap-3 overflow-x-auto pb-0.5 sm:gap-3.5">
                {rows.slice(0, 6).map((row, index) => {
                  const label = categoryDisplayName(row, lang)
                  const img = resolveMediaUrl(row.image_url)
                  const cardBg = categoryCardGradient(row, index)
                  return (
                    <div
                      key={row._key}
                      className="flex w-[4.75rem] shrink-0 flex-col sm:w-[5.25rem]"
                    >
                      <div
                        className="overflow-hidden rounded-xl p-1.5 shadow-sm"
                        style={{ background: hasCustomColors ? cardBg : '#fff' }}
                      >
                        <div className="aspect-square overflow-hidden rounded-lg bg-slate-50">
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-black text-violet-700">
                              {label.charAt(0)}
                            </div>
                          )}
                        </div>
                      </div>
                      <p
                        className={[
                          'mt-1.5 truncate text-center text-[10px] font-bold',
                          hasCustomColors ? 'text-white drop-shadow' : 'text-slate-700',
                        ].join(' ')}
                      >
                        {label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <ul className="space-y-3">
              {rows.map((row, index) => {
                const label = categoryDisplayName(row, lang)
                const rowGradient = categoryCardGradient(row, index)
                return (
                  <li
                    key={row._key}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <div
                        className="relative flex w-[5.5rem] shrink-0 flex-col overflow-hidden rounded-2xl shadow-md sm:w-[6rem]"
                        style={{ background: rowGradient }}
                      >
                        <span className="sf-mobile-cat-card-shine pointer-events-none absolute inset-0" />
                        <div className="relative p-2">
                          <div className="aspect-square overflow-hidden rounded-xl bg-white/25 p-1 ring-2 ring-white/30">
                            {resolveMediaUrl(row.image_url) ? (
                              <img
                                src={resolveMediaUrl(row.image_url)!}
                                alt=""
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-lg font-black text-white">
                                {label.charAt(0)}
                              </div>
                            )}
                          </div>
                          <p className="mt-1.5 truncate text-center text-[9px] font-bold text-white drop-shadow">
                            {label}
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{label}</p>
                            <p className="text-xs text-slate-500">
                              {t('onlineShop.categoryCardsProducts').replace(
                                '{n}',
                                String(row.product_count),
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveRow(index, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                              aria-label={t('onlineShop.categoryCardsMoveUp')}
                            >
                              <ArrowUp className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              disabled={index === rows.length - 1}
                              onClick={() => moveRow(index, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800"
                              aria-label={t('onlineShop.categoryCardsMoveDown')}
                            >
                              <ArrowDown className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {t('onlineShop.categoryCardsPresets')}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {STOREFRONT_CATEGORY_BG_PRESETS.map((preset) => {
                              const active = presetMatchesCategory(row, preset)
                              const presetLabel = t(`onlineShop.categoryPreset.${preset.labelKey}`)
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => applyPreset(index, preset.from, preset.to)}
                                  className={[
                                    'h-8 w-8 rounded-lg ring-2 transition active:scale-95',
                                    active ? 'ring-violet-500 ring-offset-2' : 'ring-transparent',
                                  ].join(' ')}
                                  style={{
                                    background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                                  }}
                                  title={presetLabel}
                                  aria-label={presetLabel}
                                  aria-pressed={active}
                                />
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {t('onlineShop.categoryCardsColorFrom')}
                            <input
                              type="color"
                              value={row.storefront_bg_from || '#5b21b6'}
                              onChange={(e) => setColor(index, 'storefront_bg_from', e.target.value)}
                              className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600"
                            />
                          </label>
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {t('onlineShop.categoryCardsColorTo')}
                            <input
                              type="color"
                              value={row.storefront_bg_to || '#c4b5fd'}
                              onChange={(e) => setColor(index, 'storefront_bg_to', e.target.value)}
                              className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        ) : null}
        {saved ? (
          <p className="text-sm font-medium text-emerald-600">{t('onlineShop.categoryCardsSaved')}</p>
        ) : null}

        {!empty ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t('common.loading') : t('onlineShop.categoryCardsSave')}
            </button>
            <button
              type="button"
              onClick={() => void handleResetColors()}
              disabled={busy || loading || !hasCustomColors}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" aria-hidden />
              )}
              {resetting ? t('common.loading') : t('onlineShop.categoryCardsResetColors')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
