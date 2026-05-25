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
    <div className="sf-product-toolbar mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm lg:p-3">
      <div className="sf-scrollbar-none flex flex-nowrap items-center gap-2 overflow-x-auto lg:flex-wrap lg:overflow-visible lg:gap-2.5">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />

        <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-700 sm:text-sm">
          <span className="whitespace-nowrap">{labels.sort}</span>
          <select
            value={sortKey}
            onChange={(e) => onSortChange(e.target.value as ProductSortKey)}
            className="max-w-[6.75rem] shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-800 sm:max-w-none sm:px-3 sm:py-2 sm:text-sm"
          >
            <option value="default">{labels.sortDefault}</option>
            <option value="price_asc">{labels.sortPriceAsc}</option>
            <option value="price_desc">{labels.sortPriceDesc}</option>
            <option value="name">{labels.sortName}</option>
            <option value="newest">{labels.sortNewest}</option>
          </select>
        </label>

        <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden />

        <button
          type="button"
          onClick={() => onFiltersChange({ ...filters, inStockOnly: !filters.inStockOnly })}
          className={[
            'shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition sm:py-2',
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
            'shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition sm:py-2',
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
            className="shrink-0 whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:py-2"
            style={{ borderColor: accentAlpha(accent, 0.35), color: accent }}
          >
            {labels.clearFilters}
          </button>
        ) : null}
      </div>
    </div>
  )
}
