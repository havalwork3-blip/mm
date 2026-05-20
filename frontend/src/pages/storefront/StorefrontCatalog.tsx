import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageOpen,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  fetchPublicCatalog,
  type PublicStorefrontCategory,
  type PublicStorefrontProduct,
} from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { formatUsd, storefrontStrings } from './storefrontStrings'
import { accentAlpha, resolveAccent } from './storefrontTheme'

const CATEGORY_GRADIENTS = [
  'linear-gradient(145deg, #ff6b35 0%, #ff8f5a 100%)',
  'linear-gradient(145deg, #22c55e 0%, #4ade80 100%)',
  'linear-gradient(145deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(145deg, #a855f7 0%, #c084fc 100%)',
  'linear-gradient(145deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(145deg, #14b8a6 0%, #2dd4bf 100%)',
]

function ProductCard({
  product,
  accent,
  inCart,
  onAdd,
  labels,
}: {
  product: PublicStorefrontProduct
  accent: string
  inCart: number
  onAdd: () => void
  labels: { addToCart: string; inCart: string; usd: string }
}) {
  const img = resolveMediaUrl(product.image_url)
  const price = Number.parseFloat(product.sell_price)

  return (
    <li className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)] ring-1 ring-slate-100/80 transition hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <PackageOpen className="h-10 w-10" strokeWidth={1.25} aria-hidden />
          </div>
        )}
        {inCart > 0 ? (
          <span
            className="absolute start-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            ×{inCart}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-800">
          {product.name}
        </h3>
        <p className="text-base font-bold" style={{ color: accent }}>
          ${formatUsd(Number.isFinite(price) ? price : 0)}{' '}
          <span className="text-xs font-normal text-slate-400">{labels.usd}</span>
        </p>
        <button
          type="button"
          onClick={onAdd}
          className={[
            'mt-auto flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.98]',
            inCart > 0 ? 'border-2 bg-white' : 'text-white shadow-md',
          ].join(' ')}
          style={
            inCart > 0
              ? { borderColor: accent, color: accent }
              : { backgroundColor: accent, boxShadow: `0 6px 20px ${accentAlpha(accent, 0.35)}` }
          }
        >
          {inCart > 0 ? (
            <>
              <ShoppingCart className="h-4 w-4" aria-hidden />
              {labels.inCart}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              {labels.addToCart}
            </>
          )}
        </button>
      </div>
    </li>
  )
}

function CategoryChip({
  category,
  index,
  selected,
  accent,
  onSelect,
}: {
  category: PublicStorefrontCategory
  index: number
  selected: boolean
  accent: string
  onSelect: () => void
}) {
  const firstImg = category.products.find((p) => p.image_url)
  const img = resolveMediaUrl(firstImg?.image_url ?? null)
  const gradient = CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-[88px] shrink-0 flex-col items-center gap-2 rounded-2xl p-2 transition',
        selected ? 'ring-2 ring-offset-2' : 'opacity-90 hover:opacity-100',
      ].join(' ')}
      style={selected ? ({ ['--tw-ring-color' as string]: accent } as React.CSSProperties) : undefined}
    >
      <div
        className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl shadow-md"
        style={{ background: img ? undefined : gradient }}
      >
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/90">
            {category.name.charAt(0)}
          </span>
        )}
      </div>
      <span
        className={[
          'line-clamp-2 w-full text-center text-[11px] font-semibold leading-tight',
          selected ? 'text-slate-900' : 'text-slate-600',
        ].join(' ')}
      >
        {category.name}
      </span>
    </button>
  )
}

export function StorefrontCatalog() {
  const { lang, isRtl } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId, shopName, appearance } = useStorefrontShop()
  const addItem = useCartStore((st) => st.addItem)
  const cartLines = useCartStore((st) => st.lines)

  const [categories, setCategories] = useState<PublicStorefrontCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  const accent = resolveAccent(appearance.accent_color)
  const promoText = appearance.welcome_message || appearance.catalog_subtitle || s.promoDefault

  const load = useCallback(async () => {
    if (shopId == null) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicCatalog(shopId)
      setCategories(data.categories)
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

  const featuredProducts = useMemo(() => {
    const all = categories.flatMap((c) => c.products)
    return all.slice(0, 8)
  }, [categories])

  const totalProducts = categories.reduce((n, c) => n + c.products.length, 0)

  function scrollCategories(dir: 'prev' | 'next') {
    const el = categoryScrollRef.current
    if (!el) return
    const delta = dir === 'prev' ? -200 : 200
    el.scrollBy({ left: isRtl ? -delta : delta, behavior: 'smooth' })
  }

  return (
    <div className="px-4 pt-4">
      {/* Header — greeting + search */}
      <header className="mb-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-md"
            style={{ backgroundColor: accent }}
          >
            {shopName.charAt(0) || 'M'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">{s.hello}</p>
            <p className="truncate text-base font-bold text-slate-900">{shopName}</p>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={s.searchPlaceholder}
            className="w-full rounded-2xl border-0 bg-white py-3.5 pe-4 ps-10 text-sm text-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.06)] outline-none ring-1 ring-slate-100 placeholder:text-slate-400 focus:ring-2"
            style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.4) }}
          />
        </div>
      </header>

      {/* Promo banner */}
      {!loading && totalProducts > 0 ? (
        <div
          className="mb-5 flex items-center gap-4 overflow-hidden rounded-3xl p-4 text-white shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 55%, #ff8f4a 100%)`,
            boxShadow: `0 12px 32px ${accentAlpha(accent, 0.35)}`,
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold leading-tight">{shopName}</p>
            <p className="mt-1 text-sm text-white/90">{promoText}</p>
            <span className="mt-3 inline-flex rounded-full bg-white px-4 py-1.5 text-xs font-bold shadow-sm" style={{ color: accent }}>
              {s.shopNow}
            </span>
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-10 w-10 text-white/90" strokeWidth={1.5} aria-hidden />
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: accent }} aria-hidden />
          <p className="text-sm">{s.loading}</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-100 bg-red-50 px-6 py-12 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: accent }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {s.retry}
          </button>
        </div>
      ) : totalProducts === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-400">
          <PackageOpen className="h-12 w-12" strokeWidth={1.25} aria-hidden />
          <p className="text-sm">{s.noProducts}</p>
        </div>
      ) : (
        <>
          {/* Categories horizontal scroll */}
          {categories.length > 0 && !search.trim() ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{s.categories}</h2>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className="text-xs font-semibold"
                  style={{ color: accent }}
                >
                  {s.viewAll}
                </button>
              </div>
              <div className="relative">
                {categories.length > 3 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => scrollCategories('prev')}
                      className="absolute start-0 top-8 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md text-slate-600"
                      aria-label="Previous"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCategories('next')}
                      className="absolute end-0 top-8 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-md text-slate-600"
                      aria-label="Next"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                ) : null}
                <div
                  ref={categoryScrollRef}
                  className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {categories.map((cat, index) => (
                    <CategoryChip
                      key={cat.id}
                      category={cat}
                      index={index}
                      selected={selectedCategoryId === cat.id}
                      accent={accent}
                      onSelect={() =>
                        setSelectedCategoryId((prev) => (prev === cat.id ? null : cat.id))
                      }
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {/* Offers / featured strip */}
          {!search.trim() && selectedCategoryId == null && featuredProducts.length > 0 ? (
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{s.offers}</h2>
                <span className="text-xs font-semibold" style={{ color: accent }}>
                  {s.viewAll} →
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {featuredProducts.map((product) => {
                  const img = resolveMediaUrl(product.image_url)
                  const price = Number.parseFloat(product.sell_price)
                  const inCart = qtyInCart(product.id)
                  return (
                    <div
                      key={product.id}
                      className="w-[140px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] ring-1 ring-slate-100"
                    >
                      <div className="relative h-24 bg-slate-100">
                        {img ? (
                          <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-300">
                            <PackageOpen className="h-8 w-8" aria-hidden />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-1 text-xs font-semibold text-slate-800">{product.name}</p>
                        <p className="mt-0.5 text-sm font-bold" style={{ color: accent }}>
                          ${formatUsd(Number.isFinite(price) ? price : 0)}
                        </p>
                        <button
                          type="button"
                          onClick={() => addItem(product)}
                          className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-bold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {inCart > 0 ? `×${inCart}` : '+'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Product sections */}
          <section>
            <h2 className="mb-3 text-base font-bold text-slate-900">
              {appearance.catalog_title || s.catalogTitle}
            </h2>
            {filteredCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">{s.noProducts}</p>
            ) : (
              <div className="space-y-8">
                {filteredCategories.map((category) => (
                  <div key={category.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">{category.name}</h3>
                      <span className="text-xs text-slate-400">
                        {s.productCount.replace('{n}', String(category.products.length))}
                      </span>
                    </div>
                    <ul className="grid grid-cols-2 gap-3">
                      {category.products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          accent={accent}
                          inCart={qtyInCart(product.id)}
                          onAdd={() => addItem(product)}
                          labels={{
                            addToCart: s.addToCart,
                            inCart: s.inCart,
                            usd: s.usd,
                          }}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
