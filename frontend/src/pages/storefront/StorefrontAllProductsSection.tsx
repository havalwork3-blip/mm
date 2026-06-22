import { LayoutGrid } from 'lucide-react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import type { CatalogProductRow } from './storefrontCollections'
import { StorefrontProductCard } from './StorefrontProductCard'
import { accentAlpha, SF_PRODUCT_GRID } from './storefrontTheme'

type CardLabels = {
  viewProduct: string
  addToCart: string
  usd: string
  outOfStock: string
  discontinued: string
  unavailable: string
  addToFavorites: string
  removeFromFavorites: string
}

type Props = {
  shopId: number
  accent: string
  rows: CatalogProductRow[]
  title: string
  productCountLabel: string
  qtyInCart: (productId: number) => number
  cardLabels: CardLabels
  onOpenProduct: (product: PublicStorefrontProduct, categoryName: string) => void
  onAddToCart: (product: PublicStorefrontProduct) => void
}

export function StorefrontAllProductsSection({
  shopId,
  accent,
  rows,
  title,
  productCountLabel,
  qtyInCart,
  cardLabels,
  onOpenProduct,
  onAddToCart,
}: Props) {
  if (rows.length === 0) return null

  return (
    <section className="sf-all-products mt-6 sm:mt-8">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10"
          style={{ backgroundColor: accentAlpha(accent, 0.1), color: accent }}
          aria-hidden
        >
          <LayoutGrid className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="sf-heading text-base font-bold tracking-tight text-slate-900 sm:text-lg">
            {title}
          </h2>
        </div>
        <span
          className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
        >
          {productCountLabel}
        </span>
      </div>
      <ul className={SF_PRODUCT_GRID}>
        {rows.map(({ product, categoryName }) => (
          <StorefrontProductCard
            key={product.id}
            shopId={shopId}
            product={product}
            accent={accent}
            inCart={qtyInCart(product.id)}
            onOpen={() => onOpenProduct(product, categoryName)}
            onAddToCart={() => onAddToCart(product)}
            labels={cardLabels}
          />
        ))}
      </ul>
    </section>
  )
}
