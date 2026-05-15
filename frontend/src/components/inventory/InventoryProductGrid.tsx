import { useMemo } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'

import type { ProductRow } from '../../types/api'
import { InventoryProductCard } from './InventoryProductCard'

export type InventoryGridContext = {
  t: (key: string) => string
  showShopColumn: boolean
  lowStockThreshold: number
  onEditProduct?: (product: ProductRow) => void
  onSetDiscontinued?: (product: ProductRow, isDiscontinued: boolean) => void
  togglingDiscontinuedId: number | null
}

type Props = {
  items: ProductRow[]
  showShopColumn: boolean
  t: (key: string) => string
  lowStockThreshold: number
  onEditProduct?: (product: ProductRow) => void
  onSetDiscontinued?: (product: ProductRow, isDiscontinued: boolean) => void
  togglingDiscontinuedId?: number | null
}

/**
 * Subscribes only to the product list in Zustand so parent layout (header, etc.)
 * is not forced to re-render when `items` updates.
 */
export function InventoryProductGrid({
  items,
  showShopColumn,
  t,
  lowStockThreshold,
  onEditProduct,
  onSetDiscontinued,
  togglingDiscontinuedId = null,
}: Props) {
  const context = useMemo<InventoryGridContext>(
    () => ({
      t,
      showShopColumn,
      lowStockThreshold,
      onEditProduct,
      onSetDiscontinued,
      togglingDiscontinuedId,
    }),
    [t, showShopColumn, lowStockThreshold, onEditProduct, onSetDiscontinued, togglingDiscontinuedId],
  )

  if (items.length === 0) return null

  return (
    <div className="min-h-[50vh] w-full">
      <VirtuosoGrid<ProductRow, InventoryGridContext>
        style={{ height: '65vh' }}
        data={items}
        context={context}
        overscan={8}
        listClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        itemClassName="min-w-0 h-full"
        computeItemKey={(_, item) => item.id}
        itemContent={(_index, product, ctx) => (
          <InventoryProductCard
            product={product}
            showShopColumn={ctx!.showShopColumn}
            lowStockThreshold={ctx!.lowStockThreshold}
            t={ctx!.t}
            onEdit={ctx!.onEditProduct}
            onSetDiscontinued={ctx!.onSetDiscontinued}
            togglingDiscontinued={ctx!.togglingDiscontinuedId === product.id}
          />
        )}
      />
    </div>
  )
}
