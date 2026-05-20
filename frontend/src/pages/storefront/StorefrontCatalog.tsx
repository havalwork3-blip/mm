import {
  Loader2,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchPublicCatalog,
  type PublicStorefrontBanner,
  type PublicStorefrontCategory,
  type PublicStorefrontProduct,
} from '../../api/storefrontApi'
import { StorefrontHeroCarousel } from './StorefrontHeroCarousel'
import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { formatUsd, storefrontStrings } from './storefrontStrings'
import { accentAlpha, resolveAccent } from './storefrontTheme'

const CATEGORY_GRADIENTS = [
  'linear-gradient(145deg, #ff5a00 0%, #ff8c42 100%)',
  'linear-gradient(145deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(145deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(145deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(145deg, #ec4899 0%, #f472b6 100%)',
]

function formatPrice(price: number, usdLabel: string): string {
  if (!Number.isFinite(price) || price <= 0) return '—'
  return `$${formatUsd(price)} ${usdLabel}`
}

function ProductCard({
  product,
  accent,
  inCart,
  onAdd,
  labels,
  popular,
}: {
  product: PublicStorefrontProduct
  accent: string
  inCart: number
  onAdd: () => void
  labels: { addToCart: string; inCart: string; usd: string; popular: string }
  popular?: boolean
}) {
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/60 transition hover:shadow-lg hover:ring-slate-300/80">
      <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
            <PackageOpen className="h-8 w-8" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        {popular ? (
          <span
            className="absolute start-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
            style={{ backgroundColor: accent }}
          >
            {labels.popular}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onAdd}
          className="absolute end-2 bottom-2 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition active:scale-90"
          style={{
            backgroundColor: inCart > 0 ? 'white' : accent,
            color: inCart > 0 ? accent : 'white',
            border: inCart > 0 ? `2px solid ${accent}` : undefined,
          }}
          aria-label={inCart > 0 ? labels.inCart : labels.addToCart}
        >
          {inCart > 0 ? (
            <span className="text-xs font-bold">{inCart}</span>
          ) : (
            <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800">
          {product.name}
        </h3>
        <p className="text-sm font-bold" style={{ color: accent }}>
          {formatPrice(price, labels.usd)}
        </p>
      </div>
    </li>
  )
}

export function StorefrontCatalog() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId, shopName, appearance } = useStorefrontShop()
  const addItem = useCartStore((st) => st.addItem)
  const cartLines = useCartStore((st) => st.lines)

  const [categories, setCategories] = useState<PublicStorefrontCategory[]>([])
  const [banners, setBanners] = useState<PublicStorefrontBanner[]>([])
  const [rotateSeconds, setRotateSeconds] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)

  const accent = resolveAccent(appearance.accent_color)
  const promoText = appearance.welcome_message || appearance.catalog_subtitle || s.promoDefault

  function handleBannerCategory(categoryId: number) {
    setSelectedCategoryId(categoryId)
    setSearch('')
    window.setTimeout(() => {
      document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }

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

  function qtyInCart(productId: number): number {
    return cartLines.find((l) => l.productId === productId)?.quantity ?? 0
  }

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = categories
    if (selectedCategoryId != null) {
      list = list.filter((c) => c.id === selectedCategoryId)
    }
    if (!q) return list
    return list
      .map((cat) => ({
        ...cat,
        products: cat.products.filter((p) => p.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.products.length > 0)
  }, [categories, search, selectedCategoryId])

  const flatProducts = useMemo(
    () => filteredCategories.flatMap((c) => c.products.map((p) => ({ product: p, categoryId: c.id }))),
    [filteredCategories],
  )

  const popularIds = useMemo(() => {
    const ids = new Set<number>()
    for (const cat of categories) {
      for (const p of cat.products.slice(0, 1)) {
        ids.add(p.id)
      }
    }
    return ids
  }, [categories])

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)

  const cardLabels = {
    addToCart: s.addToCart,
    inCart: s.inCart,
    usd: s.usd,
    popular: s.popular,
  }

  return (
    <div className="pb-4">
      <div className="px-4 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="w-full rounded-2xl border-0 bg-white py-3 pe-4 ps-10 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-slate-200/80 placeholder:text-slate-400 focus:ring-2"
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

          <div className="mx-4 mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { icon: Truck, label: s.deliveryFast },
              { icon: Zap, label: s.orderEasy },
              { icon: ShieldCheck, label: s.support },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200/70"
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
        <div className="mx-4 mt-6 flex flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center">
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
      ) : (
        <>
          {categories.length > 1 && !search.trim() ? (
            <section className="mt-5 px-4" ref={categoriesRef}>
              <h2 className="mb-2.5 text-sm font-bold text-slate-800">{s.categories}</h2>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className={[
                    'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition',
                    selectedCategoryId == null
                      ? 'text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200',
                  ].join(' ')}
                  style={selectedCategoryId == null ? { backgroundColor: accent } : undefined}
                >
                  {s.allCategories}
                </button>
                {categories.map((cat, index) => {
                  const img = resolveMediaUrl(
                    cat.image_url ?? cat.products.find((p) => p.image_url)?.image_url ?? null,
                  )
                  const selected = selectedCategoryId === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={[
                        'flex shrink-0 items-center gap-2 rounded-full py-1.5 pe-3 ps-1 transition',
                        selected
                          ? 'text-white shadow-sm'
                          : 'bg-white text-slate-700 ring-1 ring-slate-200',
                      ].join(' ')}
                      style={selected ? { backgroundColor: accent } : undefined}
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white"
                        style={{
                          background: img ? undefined : CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length],
                        }}
                      >
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        ) : (
                          cat.name.charAt(0)
                        )}
                      </span>
                      <span className="max-w-[5.5rem] truncate text-xs font-semibold">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section id="sf-products" className="mt-5 px-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{s.allProducts}</h2>
              <span className="text-xs text-slate-400">
                {s.productCount.replace('{n}', String(flatProducts.length))}
              </span>
            </div>

            {flatProducts.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">{s.noProducts}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
                {flatProducts.map(({ product }) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    accent={accent}
                    inCart={qtyInCart(product.id)}
                    onAdd={() => addItem(product)}
                    labels={cardLabels}
                    popular={popularIds.has(product.id) && categories.length > 1}
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
