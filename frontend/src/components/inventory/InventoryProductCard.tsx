import { Ban, ImageOff, TriangleAlert } from 'lucide-react'
import { memo } from 'react'

import { resolveMediaUrl } from '../../lib/api'
import type { ProductRow } from '../../types/api'

type Props = {
  product: ProductRow
  showShopColumn: boolean
  lowStockThreshold: number
  t: (key: string) => string
  onEdit?: (product: ProductRow) => void
  onSetDiscontinued?: (product: ProductRow, isDiscontinued: boolean) => void
  togglingDiscontinued?: boolean
}

export const InventoryProductCard = memo(function InventoryProductCard({
  product: p,
  showShopColumn,
  lowStockThreshold,
  t,
  onEdit,
  onSetDiscontinued,
  togglingDiscontinued = false,
}: Props) {
  const effectiveThreshold = p.low_stock_threshold ?? lowStockThreshold
  const lowStock = p.current_stock_quantity <= effectiveThreshold
  const discontinued = Boolean(p.is_discontinued)
  return (
    <article
      className={`flex h-full min-h-[150px] gap-3 rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-800/60 ${
        discontinued
          ? 'border-slate-400 bg-slate-50/80 opacity-90 dark:border-slate-600 dark:bg-slate-800/50'
          : lowStock
            ? 'border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/25'
            : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {p.image_url ? (
          <img
            src={resolveMediaUrl(p.image_url) ?? ''}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <ImageOff className="h-8 w-8" aria-hidden />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col text-start">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{p.name}</h2>
          {lowStock ? (
            <span className="shrink-0 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
              {t('inv.lowStock')}
            </span>
          ) : null}
        </div>
        {discontinued ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800">
            <Ban className="h-3.5 w-3.5" aria-hidden />
            {t('inv.notCarriedAnymore')}
          </p>
        ) : null}
        {p.is_unregistered_placeholder ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            {t('inv.unregisteredProductHint')}
          </p>
        ) : null}
        {showShopColumn && p.shop_name ? (
          <p className="mt-0.5 text-xs font-medium text-violet-700">
            {t('admin.colShop')}: {p.shop_name}
          </p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">
          {p.sku || p.barcode || '—'}
        </p>
        <p className="mt-0.5 text-xs text-slate-600">
          {t('inv.labelStock')}{' '}
          <span className={`font-semibold ${lowStock ? 'text-red-700' : 'text-slate-800'}`}>
            {p.current_stock_quantity}
          </span>
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {t('inv.productLowStockThreshold')}: {effectiveThreshold}
        </p>
        {onEdit || onSetDiscontinued ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(p)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('crud.edit')}
              </button>
            ) : null}
            {onSetDiscontinued ? (
              <button
                type="button"
                disabled={togglingDiscontinued}
                onClick={() => onSetDiscontinued(p, !discontinued)}
                className={
                  discontinued
                    ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60'
                    : 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
                }
              >
                {togglingDiscontinued
                  ? t('inv.saving')
                  : discontinued
                    ? t('inv.restoreProduct')
                    : t('inv.stopCarrying')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
})
