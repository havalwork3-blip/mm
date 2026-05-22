import { PackageOpen, Search } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { resolveMediaUrl } from '../../lib/api'
import { categoryDisplayName } from '../../lib/categoryNames'
import { matchProductSearch } from './storefrontProductSearch'
import { useLocale } from '../../context/LocaleContext'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { StorefrontBackButton } from './StorefrontBackButton'
import { accentAlpha } from './storefrontTheme'

type Props = {
  open: boolean
  onClose: () => void
  placeholder: string
  accent: string
  closeLabel: string
}

export function StorefrontSearchOverlay({
  open,
  onClose,
  placeholder,
  accent,
  closeLabel,
}: Props) {
  const { lang } = useLocale()
  const s = storefrontStrings(lang)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    search,
    setSearch,
    setSearchActive,
    catalogCategories,
    openProduct,
    closeSearch,
  } = useStorefrontCatalog()

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 1) return []
    const out: { product: (typeof catalogCategories)[0]['products'][0]; categoryName: string }[] = []
    for (const cat of catalogCategories) {
      const catName = categoryDisplayName(cat, lang)
      for (const p of cat.products) {
        if (matchProductSearch(p, q)) {
          out.push({ product: p, categoryName: catName })
        }
      }
    }
    return out.slice(0, 24)
  }, [catalogCategories, search, lang])

  function pickProduct(
    product: (typeof catalogCategories)[0]['products'][0],
    categoryName: string,
  ) {
    setSearch('')
    setSearchActive(false)
    closeSearch()
    onClose()
    openProduct(product, categoryName)
  }

  if (!open) return null

  return (
    <div className="sf-search-overlay fixed inset-0 z-[60] flex flex-col" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="sf-search-panel relative z-10 mx-3 mt-[max(0.75rem,env(safe-area-inset-top))] sm:mx-auto sm:max-w-lg">
        <div className="sf-glass-strong overflow-hidden rounded-3xl border border-white/70 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2">
            <StorefrontBackButton
              label={s.backToProducts}
              onClick={onClose}
              variant="surface"
              accent={accent}
              showLabel={false}
            />
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: accent }}
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                value={search}
                onChange={(e) => {
                  const v = e.target.value
                  setSearch(v)
                  setSearchActive(v.trim().length > 0)
                }}
                placeholder={placeholder}
                className="sf-search-input w-full rounded-2xl border-0 bg-slate-50/90 py-3.5 pe-3 ps-11 text-base text-slate-800 outline-none ring-1 ring-slate-200/60 placeholder:text-slate-400 focus:ring-2"
                style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.45) }}
                autoComplete="off"
              />
            </div>
          </div>

          {search.trim().length >= 1 ? (
            <div className="max-h-[min(50vh,320px)] overflow-y-auto border-t border-slate-100/80">
              {suggestions.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{s.searchNoResults}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {suggestions.map(({ product, categoryName }) => {
                    const img = resolveMediaUrl(product.image_url)
                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => pickProduct(product, categoryName)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-slate-50"
                        >
                          <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {img ? (
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-slate-300">
                                <PackageOpen className="h-5 w-5" />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {product.name}
                            </span>
                            {categoryName ? (
                              <span className="block truncate text-xs text-slate-500">{categoryName}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : (
            <p className="px-4 py-2.5 text-center text-[11px] font-medium text-slate-500">
              {s.searchTypeHint}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
