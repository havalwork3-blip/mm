import {
  ArrowRight,
  Loader2,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fetchPublicCatalog,
  type PublicStorefrontBanner,
  type PublicStorefrontCategory,
} from '../../api/storefrontApi'
import { CategoriesBrowse } from './CategoriesBrowse'
import { CategoryFilterBar } from './CategoryFilterBar'
import { StorefrontHeroCarousel } from './StorefrontHeroCarousel'
import { StorefrontProductCard } from './StorefrontProductCard'
import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { categoryDisplayName } from '../../lib/categoryNames'
import { accentAlpha, resolveAccent, SF_INSET_X, SF_PRODUCT_GRID } from './storefrontTheme'

export function StorefrontCatalog() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId, shopName, appearance } = useStorefrontShop()
  const {
    view,
    selectedCategoryId,
    selectCategory,
    showAllProducts,
    backToCategories,
    setSearchActive,
  } = useStorefrontCatalog()
  const addItem = useCartStore((st) => st.addItem)
  const cartLines = useCartStore((st) => st.lines)

  const [categories, setCategories] = useState<PublicStorefrontCategory[]>([])
  const [banners, setBanners] = useState<PublicStorefrontBanner[]>([])
  const [rotateSeconds, setRotateSeconds] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

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
      setBanners(data.banners ?? [])
      setRotateSeconds(data.storefront?.banner_rotate_seconds ?? 5)
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadError)
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [shopId, s.loadError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (view !== 'categories') return
    setSearch('')
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
    return list
      .map((cat) => ({
        ...cat,
        products: cat.products.filter((p) => p.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.products.length > 0)
  }, [categories, search, selectedCategoryId, showProductsView])

  const flatProducts = useMemo(
    () =>
      filteredCategories.flatMap((c) =>
        c.products.map((p) => ({ product: p, categoryName: categoryDisplayName(c, lang) })),
      ),
    [filteredCategories, lang],
  )

  const selectedCategoryName =
    selectedCategoryId != null
      ? categoryDisplayName(categories.find((c) => c.id === selectedCategoryId) ?? {}, lang)
      : ''

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)

  const cardLabels = {
    addToCart: s.addToCart,
    inCart: s.inCart,
    added: s.addedToCart,
    usd: s.usd,
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setSearchActive(value.trim().length > 0)
  }

  function handleBannerCategory(categoryId: number) {
    selectCategory(categoryId)
  }

  function handleFilterSelect(id: number | null) {
    if (id == null) {
      showAllProducts()
    } else {
      selectCategory(id)
    }
  }

  return (
    <div className="w-full pb-4 sm:pb-6">
      <div className={`${SF_INSET_X} pt-3 sm:pt-4`}>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="w-full rounded-2xl border-0 bg-white py-3 pe-4 ps-10 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2 sm:py-3.5 sm:text-base"
            style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.45) }}
          />
        </div>
      </div>

      {!loading && totalProducts > 0 ? (
        <>
          <StorefrontHeroCarousel
            banners={banners}
            accent={accent}
            rotateSeconds={rotateSeconds}
            fallbackTitle={promoText}
            fallbackSubtitle={shopName}
            onCategoryClick={handleBannerCategory}
          />

          <div className={`${SF_INSET_X} mt-3 flex gap-2 overflow-x-auto pb-1 sf-scrollbar-none sm:mt-4 sm:gap-3`}>
            {[
              { icon: Truck, label: s.deliveryFast },
              { icon: Zap, label: s.orderEasy },
              { icon: ShieldCheck, label: s.support },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70 sm:px-4 sm:py-2 sm:text-xs"
              >
                <Icon className="h-3.5 w-3.5" style={{ color: accent }} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
          <Loader2 className="h-9 w-9 animate-spin" style={{ color: accent }} aria-hidden />
          <p className="text-sm">{s.loading}</p>
        </div>
      ) : error ? (
        <div className={`${SF_INSET_X} mt-6 flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center`}>
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            <RefreshCw className="me-1.5 inline h-4 w-4" aria-hidden />
            {s.retry}
          </button>
        </div>
      ) : totalProducts === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-slate-400">
          <PackageOpen className="h-11 w-11" strokeWidth={1.25} aria-hidden />
          <p className="text-sm">{s.noProducts}</p>
        </div>
      ) : !showProductsView && categories.length > 0 ? (
        <CategoriesBrowse
          categories={categories}
          accent={accent}
          labels={{
            pickCategory: s.pickCategory,
            pickCategoryHint: s.pickCategoryHint,
            viewAllProducts: s.viewAllProducts,
            productCount: s.productCount,
            categories: s.categories,
          }}
          onSelectCategory={selectCategory}
          onViewAllProducts={showAllProducts}
        />
      ) : (
        <>
          <div className={`${SF_INSET_X} mt-3`}>
            <button
              type="button"
              onClick={backToCategories}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 sm:text-sm"
            >
              <ArrowRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
              {s.backToCategories}
            </button>
          </div>

          {categories.length > 0 ? (
            <CategoryFilterBar
              categories={categories}
              selectedId={selectedCategoryId}
              accent={accent}
              labels={{
                filter: s.filterByCategory,
                allCategories: s.allCategories,
                productCount: s.productCount,
              }}
              onSelect={handleFilterSelect}
            />
          ) : null}

          <section id="sf-products" className={`mt-4 ${SF_INSET_X} sm:mt-6`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 sm:text-base md:text-lg">
                  {selectedCategoryId != null ? selectedCategoryName : s.allProducts}
                </h2>
                {search.trim() ? (
                  <p className="text-xs text-slate-500">
                    {s.searchResults.replace('{q}', search.trim())}
                  </p>
                ) : null}
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: accentAlpha(accent, 0.12),
                  color: accent,
                }}
              >
                {s.productCount.replace('{n}', String(flatProducts.length))}
              </span>
            </div>

            {flatProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{s.noProductsInCategory}</p>
            ) : (
              <ul className={SF_PRODUCT_GRID}>
                {flatProducts.map(({ product }) => (
                  <StorefrontProductCard
                    key={product.id}
                    product={product}
                    accent={accent}
                    inCart={qtyInCart(product.id)}
                    onAdd={() => addItem(product)}
                    labels={cardLabels}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
