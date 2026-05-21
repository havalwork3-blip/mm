import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct,
  StorefrontProductCollection,
} from '../../api/storefrontApi'
import { StorefrontCategoryIconsRow } from './StorefrontCategoryIconsRow'
import { StorefrontMobileCategories } from './StorefrontMobileCategories'
import { StorefrontCollectionSections } from './StorefrontCollectionSections'
import type { CatalogProductRow } from './storefrontCollections'
import { SF_INSET_X } from './storefrontTheme'

type Props = {
  shopId: number
  catalogRows: CatalogProductRow[]
  favoriteIds: number[]
  cartProductIds: number[]
  qtyInCart: (productId: number) => number
  onAddToCart: (product: PublicStorefrontProduct) => void
  categories: PublicStorefrontCategory[]
  accent: string
  labels: {
    pickCategoryHint: string
    viewAll: string
    viewAllProducts: string
    productCount: string
    categories: string
    shopCategories: string
    shopHighlights: string
    bestsellers: string
    bestsellersHint: string
    newArrivals: string
    newArrivalsHint: string
    onSale: string
    onSaleHint: string
    availableNow: string
    availableNowHint: string
    addToCart: string
    addToFavorites: string
    removeFromFavorites: string
  }
  onSelectCategory: (id: number) => void
  onSelectCollection: (id: StorefrontProductCollection) => void
  onOpenProduct: (product: PublicStorefrontProduct, categoryName: string) => void
  onViewAllProducts: () => void
}

export function CategoriesBrowse({
  shopId,
  catalogRows,
  favoriteIds,
  cartProductIds,
  qtyInCart,
  onAddToCart,
  categories,
  accent,
  labels,
  onSelectCategory,
  onSelectCollection,
  onOpenProduct,
  onViewAllProducts,
}: Props) {
  return (
    <section className={`${SF_INSET_X} sf-view-panel mt-2 sm:mt-4 lg:mt-6`}>
      <StorefrontCategoryIconsRow
        categories={categories}
        accent={accent}
        allLabel={labels.viewAllProducts}
        onSelectAll={onViewAllProducts}
        onSelectCategory={onSelectCategory}
      />

      <StorefrontMobileCategories
        categories={categories}
        accent={accent}
        title={labels.shopCategories}
        productCountLabel={(n) => labels.productCount.replace('{n}', String(n))}
        onSelect={onSelectCategory}
      />

      <StorefrontCollectionSections
        shopId={shopId}
        accent={accent}
        catalogRows={catalogRows}
        favoriteIds={favoriteIds}
        cartProductIds={cartProductIds}
        qtyInCart={qtyInCart}
        onAddToCart={onAddToCart}
        labels={labels}
        onSelectCollection={onSelectCollection}
        onOpenProduct={onOpenProduct}
        onViewAllProducts={onViewAllProducts}
      />
    </section>
  )
}
