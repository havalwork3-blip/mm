import { Heart, Loader2, PackageOpen, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchPublicCatalog,
  type PublicStorefrontBanner,
  type PublicStorefrontCategory,
  type PublicStorefrontProduct,
} from '../../api/storefrontApi'
import { CategoriesBrowse } from './CategoriesBrowse'
import { CategoryFilterBar } from './CategoryFilterBar'
import { StorefrontHeroCarousel } from './StorefrontHeroCarousel'
import { StorefrontProductCard } from './StorefrontProductCard'
import { StorefrontProductDetail } from './StorefrontProductDetail'
import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import {
  EMPTY_FAVORITE_IDS,
  useStorefrontFavoritesStore,
} from '../../store/storefrontFavoritesStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { categoryDisplayName } from '../../lib/categoryNames'
import { sortProductsAvailableFirst } from './productAvailability'
import {
  buildCatalogRows,
  collectionTitle,
  filterCatalogByCollection,
} from './storefrontCollections'
import { accentAlpha, resolveAccent, SF_INSET_X, SF_PRODUCT_GRID } from './storefrontTheme'

export function StorefrontCatalog() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId, appearance, mergeAppearance, setExchangeRate, setDeliveryZones } =
    useStorefrontShop()
  const {
    view,
    selectedCategoryId,
    productCollection,
    selectedProduct,
    productCategoryName,
    search,
    selectCategory,
    showAllProducts,
    showCollection,
    openProduct,
    backFromProduct,
    setSearchActive,
    setCatalogCategories,
  } = useStorefrontCatalog()
  const addItem = useCartStore((st) => st.addItem)
  const setQuantity = useCartStore((st) => st.setQuantity)
  const cartLines = useCartStore((st) => st.lines)
  const hydrateFavorites = useStorefrontFavoritesStore((st) => st.hydrate)
  const favoriteIds = useStorefrontFavoritesStore((st) =>
    shopId != null ? st.favoriteIds(shopId) : EMPTY_FAVORITE_IDS,
  )

  const [categories, setCategories] = useState<PublicStorefrontCategory[]>([])
  const [banners, setBanners] = useState<PublicStorefrontBanner[]>([])
  const [rotateSeconds, setRotateSeconds] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const accent = resolveAccent(appearance.accent_color)
  const promoText = appearance.welcome_message || appearance.catalog_subtitle || s.promoDefault

  const showProductsView = view === 'products' || search.trim().length > 0

  const load = useCallback(async () => {
    if (shopId == null) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicCatalog(shopId)
      setCategories(data.categories)
      setCatalogCategories(data.categories)
      setDeliveryZones(data.delivery_zones ?? [])
      setBanners(data.banners ?? [])
      setRotateSeconds(data.storefront?.banner_rotate_seconds ?? 5)
      if (data.storefront) mergeAppearance(data.storefront)
      setExchangeRate(data.exchange_rate_usd_to_iqd)
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadError)
      setCategories([])
      setCatalogCategories([])
      setDeliveryZones([])
    } finally {
      setLoading(false)
    }
  }, [shopId, s.loadError, mergeAppearance, setExchangeRate, setCatalogCategories, setDeliveryZones])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    hydrateFavorites()
  }, [hydrateFavorites])

  useEffect(() => {
    if (view !== 'categories') return
    setSearchActive(false)
  }, [view, setSearchActive])

  function qtyInCart(productId: number): number {
    return cartLines.find((l) => l.productId === productId)?.quantity ?? 0
  }

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = categories
    if (showProductsView && selectedCategoryId != null) {
      list = list.filter((c) => c.id === selectedCategoryId)
    }
    if (!q) return list
    return list.map((cat) => ({
      ...cat,
      products: cat.products.filter((p) => p.name.toLowerCase().includes(q)),
    }))
  }, [categories, search, selectedCategoryId, showProductsView])

  const allCatalogRows = useMemo(
    () => sortProductsAvailableFirst(buildCatalogRows(categories, lang)),
    [categories, lang],
  )

  const cartProductIds = useMemo(
    () => cartLines.map((l) => l.productId),
    [cartLines],
  )

  const flatProducts = useMemo(() => {
    const rows =
      productCollection != null
        ? allCatalogRows
        : filteredCategories.flatMap((c) =>
            c.products.map((p) => ({
              product: p,
              categoryName: categoryDisplayName(c, lang),
            })),
          )
    const filtered = filterCatalogByCollection(
      rows,
      productCollection,
      favoriteIds,
      cartProductIds,
    )
    return productCollection === 'available_now'
      ? filtered
      : sortProductsAvailableFirst(filtered)
  }, [filteredCategories, lang, productCollection, favoriteIds, cartProductIds, allCatalogRows])

  const selectedCategory =
    selectedCategoryId != null ? categories.find((c) => c.id === selectedCategoryId) : null

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)

  const productsHeading = collectionTitle(s, productCollection)

  const cardLabels = {
    viewProduct: s.viewProduct,
    addToCart: s.addToCart,
    usd: s.usd,
    outOfStock: s.outOfStock,
    discontinued: s.discontinued,
    unavailable: s.unavailable,
    addToFavorites: s.addToFavorites,
    removeFromFavorites: s.removeFromFavorites,
  }

  const availabilityLabels = {
    outOfStock: s.outOfStock,
    discontinued: s.discontinued,
    unavailable: s.unavailable,
    unavailableHint: s.unavailableHint,
    cannotOrder: s.cannotOrder,
  }

  function handleOpenProduct(product: PublicStorefrontProduct, categoryName: string) {
    openProduct(product, categoryName)
  }

  function handleAddToCart(product: PublicStorefrontProduct) {
    addItem(product, 1)
  }

  function handleAddFromDetail(quantity: number) {
    if (!selectedProduct) return
    const existing = cartLines.find((l) => l.productId === selectedProduct.id)
    if (existing) {
      setQuantity(selectedProduct.id, quantity)
    } else {
      addItem(selectedProduct, quantity)
    }
  }

  const showBrowseChrome = view !== 'product' && !loading && !error && totalProducts > 0

  return (
    <div className="sf-catalog w-full pb-4 sm:pb-6">
      {showBrowseChrome ? (
        <StorefrontHeroCarousel
          banners={banners}
          accent={accent}
          rotateSeconds={rotateSeconds}
          fallbackTitle={promoText}
          fallbackSubtitle={appearance.catalog_subtitle || ''}
          onCategoryClick={selectCategory}
        />
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} aria-hidden />
          <p className="text-sm font-medium">{s.loading}</p>
        </div>
      ) : error ? (
        <div
          className={`${SF_INSET_X} mx-auto mt-6 max-w-md rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center`}
        >
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            <RefreshCw className="me-1.5 inline h-4 w-4" aria-hidden />
            {s.retry}
          </button>
        </div>
      ) : totalProducts === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-slate-400">
          <PackageOpen className="h-12 w-12" strokeWidth={1.25} aria-hidden />
          <p className="text-sm">{s.noProducts}</p>
        </div>
      ) : (
        <div className="sf-stage relative mt-2">
          <div
            className={[
              'sf-view-panel transition-all duration-300 ease-out',
              view === 'categories' && !showProductsView
                ? 'sf-view-active opacity-100'
                : 'sf-view-hidden pointer-events-none absolute inset-x-0 opacity-0',
            ].join(' ')}
            aria-hidden={view !== 'categories' || showProductsView}
          >
            {shopId != null ? (
              <CategoriesBrowse
                shopId={shopId}
                catalogRows={allCatalogRows}
                favoriteIds={favoriteIds}
                cartProductIds={cartProductIds}
                qtyInCart={qtyInCart}
                onAddToCart={handleAddToCart}
                categories={categories.filter((c) => c.products.length > 0)}
                accent={accent}
                labels={{
                  pickCategoryHint: s.pickCategoryHint,
                  viewAll: s.viewAll,
                  viewAllProducts: s.viewAllProducts,
                  productCount: s.productCount,
                  categories: s.categories,
                  shopCategories: s.shopCategories,
                  shopHighlights: s.shopHighlights,
                  bestsellers: s.bestsellers,
                  bestsellersHint: s.bestsellersHint,
                  newArrivals: s.newArrivals,
                  newArrivalsHint: s.newArrivalsHint,
                  onSale: s.onSale,
                  onSaleHint: s.onSaleHint,
                  availableNow: s.availableNow,
                  availableNowHint: s.availableNowHint,
                  addToCart: s.addToCart,
                  addToFavorites: s.addToFavorites,
                  removeFromFavorites: s.removeFromFavorites,
                }}
                onSelectCategory={selectCategory}
                onSelectCollection={showCollection}
                onOpenProduct={handleOpenProduct}
                onViewAllProducts={showAllProducts}
              />
            ) : null}
          </div>

          <div
            className={[
              'sf-view-panel transition-all duration-300 ease-out',
              showProductsView && view !== 'product'
                ? 'sf-view-active opacity-100'
                : 'sf-view-hidden pointer-events-none absolute inset-x-0 opacity-0',
            ].join(' ')}
            aria-hidden={!showProductsView || view === 'product'}
          >
            {categories.length > 0 && !productCollection ? (
              <CategoryFilterBar
                categories={categories}
                selectedId={selectedCategoryId}
                accent={accent}
                labels={{
                  filter: s.filterByCategory,
                  allCategories: s.allCategories,
                  productCount: s.productCount,
                }}
                onSelect={(id) => {
                  if (id == null) showAllProducts()
                  else selectCategory(id)
                }}
              />
            ) : null}

            <section className={`${SF_INSET_X} pb-6 pt-2 sm:pt-4`}>
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="sf-heading text-lg font-extrabold tracking-tight sm:text-xl">
                  {productsHeading
                    ? productsHeading
                    : selectedCategory
                      ? categoryDisplayName(selectedCategory, lang)
                      : search.trim()
                        ? s.searchResults.replace('{q}', search.trim())
                        : s.allProducts}
                </h2>
                <span
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{ backgroundColor: accentAlpha(accent, 0.12), color: accent }}
                >
                  {s.productCount.replace('{n}', String(flatProducts.length))}
                </span>
              </div>

              {flatProducts.length === 0 ? (
                productCollection === 'favorites' ? (
                  <div className="sf-favorites-empty flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200/70">
                    <span
                      className="flex h-16 w-16 items-center justify-center rounded-full"
                      style={{ backgroundColor: accentAlpha(accent, 0.12) }}
                    >
                      <Heart className="h-8 w-8" style={{ color: accent }} aria-hidden />
                    </span>
                    <p className="text-base font-extrabold text-slate-800">{s.favoritesEmpty}</p>
                    <p className="max-w-xs text-sm text-slate-500">{s.favoritesEmptyHint}</p>
                  </div>
                ) : (
                  <p className="py-16 text-center text-sm text-slate-500">{s.noProductsInCategory}</p>
                )
              ) : (
                <ul className={SF_PRODUCT_GRID}>
                  {shopId != null
                    ? flatProducts.map(({ product, categoryName }) => (
                    <StorefrontProductCard
                      key={product.id}
                      shopId={shopId}
                      product={product}
                      accent={accent}
                      inCart={qtyInCart(product.id)}
                      onOpen={() => handleOpenProduct(product, categoryName)}
                      onAddToCart={() => handleAddToCart(product)}
                      labels={cardLabels}
                    />
                  ))
                    : null}
                </ul>
              )}

            </section>
          </div>
        </div>
      )}

      {selectedProduct && view === 'product' && shopId != null ? (
        <StorefrontProductDetail
          shopId={shopId}
          product={selectedProduct}
          categoryName={productCategoryName}
          accent={accent}
          inCart={qtyInCart(selectedProduct.id)}
          labels={{
            back: s.backToProducts,
            orderNow: s.orderNow,
            added: s.addedToCart,
            quantity: s.quantity,
            usd: s.usd,
            inCart: s.inCart,
            addToFavorites: s.addToFavorites,
            removeFromFavorites: s.removeFromFavorites,
            ...availabilityLabels,
          }}
          onBack={backFromProduct}
          onAdd={handleAddFromDetail}
        />
      ) : null}
    </div>
  )
}
