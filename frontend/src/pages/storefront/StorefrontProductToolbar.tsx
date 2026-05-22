import { SlidersHorizontal } from 'lucide-react'

import type { ProductListFilters, ProductSortKey } from './storefrontProductSort'
import { accentAlpha } from './storefrontTheme'

type Labels = {
  sort: string
  sortDefault: string
  sortPriceAsc: string
  sortPriceDesc: string
  sortName: string
  sortNewest: string
  filterInStock: string
  filterOnSale: string
  clearFilters: string
}

type Props = {
  accent: string
  sortKey: ProductSortKey
  filters: ProductListFilters
  hasActiveFilters: boolean
  labels: Labels
  onSortChange: (key: ProductSortKey) => void
  onFiltersChange: (next: ProductListFilters) => void
  onClearFilters: () => void
}

export function StorefrontProductToolbar({
  accent,
  sortKey,
  filters,
  hasActiveFilters,
  labels,
  onSortChange,
  onFiltersChange,
  onClearFilters,
}: Props) {
  return (
    <div className="sf-product-toolbar mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between lg:p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-slate-700">
          <span className="shrink-0">{labels.sort}</span>
          <select
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as ProductSortKey)}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800"
          >
            <option value="default">{labels.sortDefault}</option>
            <option value="price_asc">{labels.sortPriceAsc}</option>
            <option value="price_desc">{labels.sortPriceDesc}</option>
            <option value="name">{labels.sortName}</option>
            <option value="newest">{labels.sortNewest}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onFiltersChange({ ...filters, inStockOnly: !filters.inStockOnly })}
          className={[
            'rounded-xl px-3 py-2 text-xs font-bold transition',
            filters.inStockOnly ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          ].join(' ')}
          style={
            filters.inStockOnly
              ? { backgroundColor: accent, boxShadow: `0 4px 12px ${accentAlpha(accent, 0.25)}` }
              : undefined
          }
          aria-pressed={filters.inStockOnly}
        >
          {labels.filterInStock}
        </button>
        <button
          type="button"
          onClick={() => onFiltersChange({ ...filters, onSaleOnly: !filters.onSaleOnly })}
          className={[
            'rounded-xl px-3 py-2 text-xs font-bold transition',
            filters.onSaleOnly ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          ].join(' ')}
          style={
            filters.onSaleOnly
              ? { backgroundColor: accent, boxShadow: `0 4px 12px ${accentAlpha(accent, 0.25)}` }
              : undefined
          }
          aria-pressed={filters.onSaleOnly}
        >
          {labels.filterOnSale}
        </button>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-xl border px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            style={{ borderColor: accentAlpha(accent, 0.35), color: accent }}
          >
            {labels.clearFilters}
          </button>
        ) : null}
      </div>
    </div>
  )
}
