import { useEffect, useMemo, useState } from 'react'
import { VirtuosoGrid } from 'react-virtuoso'

import { useMediaQuery } from '../../hooks/useMediaQuery'
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

function renderCard(
  product: ProductRow,
  ctx: InventoryGridContext,
) {
  return (
    <InventoryProductCard
      product={product}
      showShopColumn={ctx.showShopColumn}
      lowStockThreshold={ctx.lowStockThreshold}
      t={ctx.t}
      onEdit={ctx.onEditProduct}
      onSetDiscontinued={ctx.onSetDiscontinued}
      togglingDiscontinued={ctx.togglingDiscontinuedId === product.id}
    />
  )
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
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [scrollParent, setScrollParent] = useState<HTMLElement | undefined>()

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

  useEffect(() => {
    if (isMobile) {
      setScrollParent(undefined)
      return
    }
    const el = document.querySelector('.mm-app-main-shell main')
    if (el instanceof HTMLElement) {
      setScrollParent(el)
    }
  }, [isMobile])

  if (items.length === 0) return null

  if (isMobile) {
    return (
      <div className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2">
        {items.map((product) => (
          <div key={product.id} className="min-w-0">
            {renderCard(product, context)}
          </div>
        ))}
      </div>
    )
  }

  if (!scrollParent) {
    return (
      <div className="grid grid-cols-1 gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((product) => (
          <div key={product.id} className="min-w-0">
            {renderCard(product, context)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-full touch-pan-y pb-8">
      <VirtuosoGrid<ProductRow, InventoryGridContext>
        customScrollParent={scrollParent}
        data={items}
        context={context}
        overscan={8}
        listClassName="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        itemClassName="min-w-0 h-full"
        computeItemKey={(_, item) => item.id}
        itemContent={(_index, product, ctx) => renderCard(product, ctx!)}
      />
    </div>
  )
}
