import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Save } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useLocale } from '../../context/LocaleContext'
import { resolveMediaUrl } from '../../lib/api'
import { categoryDisplayName } from '../../lib/categoryNames'
import {
  fetchMerchantStorefrontCategoryCards,
  patchMerchantStorefrontCategoryCards,
  type MerchantStorefrontCategoryCard,
} from '../../lib/merchantStorefrontCategoriesApi'
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
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const sectionGradient = sectionPanelGradient('categories')

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

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const items = rows.map((r, i) => ({
        id: r.id,
        storefront_home_order: i,
      }))
      const data = await patchMerchantStorefrontCategoryCards(items)
      setRows(toRows(data))
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
          <ArrowUpDown className="h-4 w-4" aria-hidden />
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
              className="sf-section-panel relative overflow-hidden rounded-2xl p-3 shadow-md"
              style={{ background: sectionGradient }}
            >
              <span className="sf-section-panel-shine pointer-events-none absolute inset-0" aria-hidden />
              <span className="sf-section-panel-fade pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 to-transparent" aria-hidden />
              <div className="relative flex gap-3 overflow-x-auto pb-0.5 sm:gap-3.5">
                {rows.slice(0, 8).map((row) => {
                  const label = categoryDisplayName(row, lang)
                  const img = resolveMediaUrl(row.image_url)
                  return (
                    <div
                      key={row._key}
                      className="flex w-[4.75rem] shrink-0 flex-col sm:w-[5.25rem]"
                    >
                      <div className="sf-section-cat-media">
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
                      <p className="sf-section-cat-label mt-2 truncate text-center text-[10px] font-bold text-slate-700">
                        {label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <ul className="space-y-2">
              {rows.map((row, index) => {
                const label = categoryDisplayName(row, lang)
                return (
                  <li
                    key={row._key}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-slate-900 dark:text-white">{label}</p>
                      <p className="text-xs text-slate-500">
                        {t('onlineShop.categoryCardsProducts').replace('{n}', String(row.product_count))}
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
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t('common.loading') : t('onlineShop.categoryCardsSave')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
