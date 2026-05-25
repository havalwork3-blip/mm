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
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="sf-heading text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
          {title}
        </h2>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: accentAlpha(accent, 0.12), color: accent }}
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
