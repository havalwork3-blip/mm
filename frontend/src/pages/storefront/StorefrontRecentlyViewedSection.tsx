import type { PublicStorefrontProduct } from '../../api/storefrontApi'
import type { CatalogProductRow } from './storefrontCollections'
import { StorefrontProductCardCompact } from './StorefrontProductCardCompact'
import { StorefrontSectionPanel } from './StorefrontSectionPanel'
import { SF_SECTION_PRODUCT_WIDTH, SF_SECTION_SCROLL_ROW } from './storefrontTheme'

type Props = {
  shopId: number
  accent: string
  rows: CatalogProductRow[]
  qtyInCart: (productId: number) => number
  title: string
  addToCart: string
  addToFavorites: string
  removeFromFavorites: string
  onOpenProduct: (product: PublicStorefrontProduct, categoryName: string) => void
  onAddToCart: (product: PublicStorefrontProduct) => void
}

export function StorefrontRecentlyViewedSection({
  shopId,
  accent,
  rows,
  qtyInCart,
  title,
  addToCart,
  addToFavorites,
  removeFromFavorites,
  onOpenProduct,
  onAddToCart,
}: Props) {
  if (rows.length === 0) return null

  return (
    <StorefrontSectionPanel sectionKey="recently_viewed" title={title}>
      <ul className={SF_SECTION_SCROLL_ROW}>
        {rows.map(({ product, categoryName }) => (
          <StorefrontProductCardCompact
            key={product.id}
            shopId={shopId}
            product={product}
            accent={accent}
            inCart={qtyInCart(product.id)}
            onOpen={() => onOpenProduct(product, categoryName)}
            onAddToCart={() => onAddToCart(product)}
            addToCart={addToCart}
            addToFavorites={addToFavorites}
            removeFromFavorites={removeFromFavorites}
            className={SF_SECTION_PRODUCT_WIDTH}
          />
        ))}
      </ul>
    </StorefrontSectionPanel>
  )
}
