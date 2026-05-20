import { Loader2, PackageOpen, Plus, RefreshCw, ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { fetchPublicProducts, type PublicStorefrontProduct } from '../../api/storefrontApi'
import { resolveMediaUrl } from '../../lib/api'
import { useLocale } from '../../context/LocaleContext'
import { useCartStore } from '../../store/cartStore'
import { useStorefrontShop } from './StorefrontShopContext'
import { formatUsd, storefrontStrings } from './storefrontStrings'

export function StorefrontCatalog() {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopId } = useStorefrontShop()
  const addItem = useCartStore((st) => st.addItem)
  const cartLines = useCartStore((st) => st.lines)

  const [products, setProducts] = useState<PublicStorefrontProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (shopId == null) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchPublicProducts(shopId)
      setProducts(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : s.loadError)
      setProducts([])
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

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {s.catalogTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-400 sm:text-base">{s.catalogSubtitle}</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin text-[#fbbf24]" aria-hidden />
          <p>{s.loading}</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {s.retry}
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-slate-500">
          <PackageOpen className="h-12 w-12" strokeWidth={1.25} aria-hidden />
          <p>{s.noProducts}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => {
            const img = resolveMediaUrl(product.image_url)
            const price = Number.parseFloat(product.sell_price)
            const inCart = qtyInCart(product.id)
            return (
              <li
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-[#fbbf24]/25 hover:bg-white/[0.05]"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-800/80">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-600">
                      <PackageOpen className="h-10 w-10" strokeWidth={1.25} aria-hidden />
                    </div>
                  )}
                  {inCart > 0 ? (
                    <span className="absolute start-2 top-2 rounded-full bg-[#fbbf24] px-2 py-0.5 text-xs font-bold text-[#0f172a]">
                      ×{inCart}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                  <h2 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-100 sm:text-base">
                    {product.name}
                  </h2>
                  <p className="text-base font-bold text-[#fde68a] sm:text-lg">
                    ${formatUsd(Number.isFinite(price) ? price : 0)}{' '}
                    <span className="text-xs font-normal text-slate-500">{s.usd}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => addItem(product)}
                    className={[
                      'mt-auto flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition',
                      inCart > 0
                        ? 'border border-[#fbbf24]/40 bg-[#fbbf24]/15 text-[#fde68a]'
                        : 'bg-gradient-to-l from-[#fbbf24] to-[#f59e0b] text-[#0f172a] hover:brightness-110',
                    ].join(' ')}
                  >
                    {inCart > 0 ? (
                      <>
                        <ShoppingCart className="h-4 w-4" aria-hidden />
                        {s.inCart}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" aria-hidden />
                        {s.addToCart}
                      </>
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
