import { Check, ChevronDown, ImageOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson, resolveMediaUrl } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type { JardRow } from '../types/api'

/** Products without API category — stable filter key (DB ids are positive). */
const UNCATEGORIZED_CATEGORY_KEY = -1

function categoryKey(r: JardRow): number {
  return r.category_id ?? UNCATEGORIZED_CATEGORY_KEY
}

export function JardPage() {
  const { t } = useLocale()
  const { me } = useSession()
  const [rows, setRows] = useState<JardRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(
    () => new Set(),
  )
  const [productSearch, setProductSearch] = useState('')
  /** Exact product names to include; empty = no name restriction (still category + optional search). */
  const [selectedProductNames, setSelectedProductNames] = useState<Set<string>>(
    () => new Set(),
  )
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryFilterWrapRef = useRef<HTMLDivElement>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const canView = hasPerm(me, 'view_product', 'view_sale')

  const fetchRows = useCallback(async (from: string, to: string) => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (from.trim()) params.set('from', from.trim())
      if (to.trim()) params.set('to', to.trim())
      const query = params.toString()
      const endpoint = query ? `/api/reports/jard/?${query}` : '/api/reports/jard/'
      const d = await apiJson<{ results: JardRow[] }>(endpoint)
      setRows(d.results ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canView, t])

  useEffect(() => {
    void fetchRows('', '')
  }, [fetchRows])

  useEffect(() => {
    if (!categoryDropdownOpen) return
    function handleDocMouseDown(e: MouseEvent) {
      const el = categoryFilterWrapRef.current
      if (!el || el.contains(e.target as Node)) return
      setCategoryDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleDocMouseDown)
    return () => document.removeEventListener('mousedown', handleDocMouseDown)
  }, [categoryDropdownOpen])

  /** One row per distinct category id so multi-select keys stay unique. */
  const categoryOptions = useMemo(() => {
    const seen = new Set<number>()
    const out: { key: number; label: string }[] = []
    for (const r of rows) {
      const key = categoryKey(r)
      if (seen.has(key)) continue
      seen.add(key)
      const label =
        (r.category_name && r.category_name.trim()) || t('jard.noCategory')
      out.push({ key, label })
    }
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return out
  }, [rows, t])

  /** Drop selections that no longer appear in the current report rows. */
  useEffect(() => {
    const valid = new Set<number>()
    for (const r of rows) {
      valid.add(categoryKey(r))
    }
    setSelectedCategoryIds((prev) => {
      const next = new Set<number>()
      for (const id of prev) {
        if (valid.has(id)) next.add(id)
      }
      return next
    })
  }, [rows])

  /** Remove product picks that disappeared after date refresh. */
  useEffect(() => {
    const valid = new Set(rows.map((r) => r.product_name))
    setSelectedProductNames((prev) => {
      const next = new Set<string>()
      for (const n of prev) {
        if (valid.has(n)) next.add(n)
      }
      return next
    })
  }, [rows])

  const filtered = useMemo(() => {
    let byCategory = rows
    if (selectedCategoryIds.size > 0) {
      byCategory = rows.filter((r) => selectedCategoryIds.has(categoryKey(r)))
    }
    let byProduct = byCategory
    if (selectedProductNames.size > 0) {
      byProduct = byCategory.filter((r) =>
        selectedProductNames.has(r.product_name),
      )
    }
    const q = productSearch.trim().toLowerCase()
    if (selectedProductNames.size > 0 || !q) return byProduct
    return byProduct.filter((r) => r.product_name.toLowerCase().includes(q))
  }, [rows, selectedCategoryIds, selectedProductNames, productSearch])

  const productSearchHits = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    const out: JardRow[] = []
    const seen = new Set<number>()
    for (const r of rows) {
      if (seen.has(r.product_id)) continue
      if (q && !r.product_name.toLowerCase().includes(q)) continue
      out.push(r)
      seen.add(r.product_id)
      if (out.length >= 8) break
    }
    return out
  }, [rows, productSearch])

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.remaining += r.remaining_qty
        acc.sold += r.sold_qty
        acc.remainingValueUsd += Number(r.remaining_value_usd || 0)
        acc.soldValueUsd += Number(r.sold_value_usd || 0)
        return acc
      },
      { remaining: 0, sold: 0, remainingValueUsd: 0, soldValueUsd: 0 },
    )
  }, [filtered])
  const formatUsd = (amount: number) => amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  const handleDownload = () => {
    const rowsForCsv = filtered.map((r) => [
      r.product_name,
      r.category_name || t('jard.noCategory'),
      String(r.remaining_qty),
      String(r.sold_qty),
      r.unit_buy_price_usd,
      r.remaining_value_usd,
      r.sold_value_usd,
    ])
    const headers = [
      t('jard.product'),
      t('jard.categoryColumn'),
      t('jard.remainingQty'),
      t('jard.soldQty'),
      t('jard.unitBuyPriceUsd'),
      t('jard.remainingValueUsd'),
      t('jard.soldValueUsd'),
    ]
    const escapeCsv = (value: string) => {
      const escaped = value.replace(/"/g, '""')
      return `"${escaped}"`
    }
    const csv = [headers, ...rowsForCsv].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jard-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('jard.title')}</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t('crud.permissionDenied')}
        </p>
      </div>
    )
  }

  return (
    <div id="jard-print-root" className="min-h-dvh p-4 sm:p-6">
      {/*
        Summary order (LTR; RTL mirrors visually): 1) grand total units 2) remaining units
        3) remaining value USD 4) sold units 5) sold value USD
      */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 no-print">
        <div className="rounded-lg border border-slate-300 border-t-4 border-t-indigo-500 bg-white p-4 pt-3 dark:border-slate-700 dark:border-t-indigo-400 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('jard.totalQty')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {totals.remaining + totals.sold}
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('jard.remainingQty')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {totals.remaining}
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('jard.remainingValueUsd')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatUsd(totals.remainingValueUsd)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('jard.soldQty')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {totals.sold}
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('jard.soldValueUsd')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatUsd(totals.soldValueUsd)}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 no-print">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative flex min-w-0 flex-col gap-1 lg:col-span-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('jard.searchProductLabel')}
            </label>
            <input
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setProductSearchOpen(true)
              }}
              onFocus={() => setProductSearchOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setProductSearchOpen(false), 120)
              }}
              placeholder={t('jard.searchPlaceholder')}
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
            {productSearchOpen && productSearchHits.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                {productSearchHits.map((r) => (
                  <li key={r.product_id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSelectedProductNames((prev) => {
                          const next = new Set(prev)
                          next.add(r.product_name)
                          return next
                        })
                        setProductSearch('')
                        setProductSearchOpen(false)
                      }}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start hover:bg-slate-100 dark:hover:bg-slate-700/80"
                    >
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {r.product_image_url ? (
                          <img
                            src={resolveMediaUrl(r.product_image_url) ?? ''}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-slate-400">
                            <ImageOff className="h-5 w-5" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900 dark:text-slate-100">
                          {r.product_name}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {r.category_name || t('jard.noCategory')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div
            ref={categoryFilterWrapRef}
            className="relative flex min-w-0 flex-col gap-1 lg:col-span-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('jard.categoryFilterTitle')}
                {selectedCategoryIds.size > 0 ? (
                  <span className="ms-1 font-normal tabular-nums text-indigo-600 dark:text-indigo-400">
                    ({selectedCategoryIds.size})
                  </span>
                ) : null}
              </label>
              {selectedCategoryIds.size > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds(new Set())
                    setCategoryDropdownOpen(false)
                  }}
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {t('jard.clearCategorySelection')}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              aria-expanded={categoryDropdownOpen}
              aria-haspopup="listbox"
              disabled={categoryOptions.length === 0}
              onClick={() => setCategoryDropdownOpen((o) => !o)}
              className="flex min-h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-start text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800/80"
            >
              <span className="min-w-0 flex-1 truncate">
                {categoryOptions.length === 0 ? (
                  <span className="text-slate-400 dark:text-slate-500">—</span>
                ) : selectedCategoryIds.size === 0 ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('jard.categoryFilterPlaceholder')}
                  </span>
                ) : (
                  t('jard.categoriesSelectedSummary').replace(
                    '{count}',
                    String(selectedCategoryIds.size),
                  )
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 dark:text-slate-400 ${
                  categoryDropdownOpen ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            {categoryDropdownOpen && categoryOptions.length > 0 ? (
              <div
                className="absolute inset-x-0 top-full z-[35] mt-1 overflow-hidden rounded-md border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
                role="presentation"
              >
                <p className="border-b border-slate-100 px-3 py-2 text-[11px] leading-snug text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {t('jard.categoryFilterHint')}
                </p>
                <div className="max-h-60 overflow-y-auto py-1">
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700" role="listbox">
                    {categoryOptions.map((opt) => {
                      const selected = selectedCategoryIds.has(opt.key)
                      return (
                        <li key={opt.key}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedCategoryIds((prev) => {
                                const next = new Set(prev)
                                if (next.has(opt.key)) next.delete(opt.key)
                                else next.add(opt.key)
                                return next
                              })
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-start text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/80"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-600'
                                  : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                              }`}
                              aria-hidden
                            >
                              {selected ? (
                                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 leading-snug">{opt.label}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {t('jard.selectedProductsFilter')}
                {selectedProductNames.size > 0 ? (
                  <span className="ms-1 font-normal tabular-nums text-indigo-600 dark:text-indigo-400">
                    ({selectedProductNames.size})
                  </span>
                ) : null}
              </label>
              {selectedProductNames.size > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedProductNames(new Set())}
                  className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {t('jard.clearSelectedProducts')}
                </button>
              ) : null}
            </div>
            <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900">
              {selectedProductNames.size === 0 ? (
                <span className="px-1 py-1 text-slate-500 dark:text-slate-400">
                  {t('jard.noProductsSelected')}
                </span>
              ) : (
                Array.from(selectedProductNames)
                  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                  .map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setSelectedProductNames((prev) => {
                          const next = new Set(prev)
                          next.delete(name)
                          return next
                        })
                      }
                      className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-100 dark:hover:bg-indigo-900/80"
                      title={name}
                    >
                      <span className="truncate">{name}</span>
                      <span aria-hidden className="shrink-0 opacity-70">
                        ×
                      </span>
                    </button>
                  ))
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('dash.from')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('dash.to')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <button
              type="button"
              onClick={() => void fetchRows(dateFrom, dateTo)}
              className="min-h-11 flex-1 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 lg:flex-none"
            >
              {t('dash.apply')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryIds(new Set())
                setCategoryDropdownOpen(false)
                setSelectedProductNames(new Set())
                setProductSearch('')
                setDateFrom('')
                setDateTo('')
                void fetchRows('', '')
              }}
              className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 lg:flex-none"
            >
              {t('sales.clearFilters')}
            </button>
          </div>
          <div className="ms-auto flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-11 flex-1 rounded-md bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 lg:flex-none"
            >
              {t('companiesPage.download')}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-11 flex-1 rounded-md border border-violet-300 bg-white px-4 text-sm font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-600 dark:bg-slate-900 dark:text-violet-300 dark:hover:bg-slate-800 lg:flex-none"
            >
              {t('jard.printLabel')}
            </button>
          </div>
        </div>
        </div>

      {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">{t('common.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500">{t('jard.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <table className="jard-print-table min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="sticky top-0 z-10 border-b border-e border-slate-300 bg-slate-100 px-3 py-2 text-start text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.product')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-e border-slate-300 bg-slate-100 px-3 py-2 text-start text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.categoryColumn')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-e border-slate-300 bg-slate-100 px-3 py-2 text-end text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.remainingQty')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-e border-slate-300 bg-slate-100 px-3 py-2 text-end text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.unitBuyPriceUsd')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-e border-slate-300 bg-slate-100 px-3 py-2 text-end text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.remainingValueUsd')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 px-3 py-2 text-end text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.soldQty')}
                  </th>
                  <th className="sticky top-0 z-10 border-b border-slate-300 bg-slate-100 px-3 py-2 text-end text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300">
                    {t('jard.soldValueUsd')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.product_id} className="odd:bg-white even:bg-slate-50/70 hover:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800/40 dark:hover:bg-slate-800/70">
                    <td className="border-b border-e border-slate-200 px-3 py-2 font-medium text-slate-900 dark:border-slate-700 dark:text-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProductNames((prev) => {
                            const next = new Set(prev)
                            next.add(r.product_name)
                            return next
                          })
                        }
                        className="rounded px-1 py-0.5 text-start text-slate-800 hover:bg-slate-200 hover:underline dark:text-slate-100 dark:hover:bg-slate-700/70"
                        title={r.product_name}
                      >
                        {r.product_name}
                      </button>
                    </td>
                    <td className="border-b border-e border-slate-200 px-3 py-2 text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {r.category_name || t('jard.noCategory')}
                    </td>
                    <td className="border-b border-e border-slate-200 px-3 py-2 text-end font-mono tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {r.remaining_qty}
                    </td>
                    <td className="border-b border-e border-slate-200 px-3 py-2 text-end font-mono tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {formatUsd(Number(r.unit_buy_price_usd || 0))}
                    </td>
                    <td className="border-b border-e border-slate-200 px-3 py-2 text-end font-mono tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {formatUsd(Number(r.remaining_value_usd || 0))}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-end font-mono tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {r.sold_qty}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-end font-mono tabular-nums text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {formatUsd(Number(r.sold_value_usd || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
