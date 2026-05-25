import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct,
  StorefrontProductCollection,
} from '../../api/storefrontApi'
import { StorefrontAllProductsSection } from './StorefrontAllProductsSection'
import { StorefrontMobileCategories } from './StorefrontMobileCategories'
import { StorefrontCollectionSections } from './StorefrontCollectionSections'
import type { CatalogProductRow } from './storefrontCollections'
import { StorefrontRecentlyViewedSection } from './StorefrontRecentlyViewedSection'
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
  allProductRows: CatalogProductRow[]
  allProductsTitle: string
  cardLabels: {
    viewProduct: string
    addToCart: string
    usd: string
    outOfStock: string
    discontinued: string
    unavailable: string
    addToFavorites: string
    removeFromFavorites: string
  }
  recentRows: CatalogProductRow[]
  recentTitle: string
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
  allProductRows,
  allProductsTitle,
  cardLabels,
  recentRows,
  recentTitle,
}: Props) {
  return (
    <section className={`${SF_INSET_X} sf-view-panel mt-2 sm:mt-4 lg:mt-6`}>
      <div className="lg:hidden">
        <StorefrontMobileCategories
          categories={categories}
          accent={accent}
          title={labels.shopCategories}
          subtitle={labels.pickCategoryHint}
          productCountLabel={(n) => labels.productCount.replace('{n}', String(n))}
          onSelect={onSelectCategory}
        />
      </div>

      {recentRows.length > 0 ? (
        <StorefrontRecentlyViewedSection
          shopId={shopId}
          accent={accent}
          rows={recentRows}
          qtyInCart={qtyInCart}
          title={recentTitle}
          addToCart={labels.addToCart}
          addToFavorites={labels.addToFavorites}
          removeFromFavorites={labels.removeFromFavorites}
          onOpenProduct={onOpenProduct}
          onAddToCart={onAddToCart}
        />
      ) : null}

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
      />

      <StorefrontAllProductsSection
        shopId={shopId}
        accent={accent}
        rows={allProductRows}
        title={allProductsTitle}
        productCountLabel={labels.productCount.replace('{n}', String(allProductRows.length))}
        qtyInCart={qtyInCart}
        cardLabels={cardLabels}
        onOpenProduct={onOpenProduct}
        onAddToCart={onAddToCart}
      />
    </section>
  )
}
