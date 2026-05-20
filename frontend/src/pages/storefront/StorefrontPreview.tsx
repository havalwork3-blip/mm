import { PackageOpen, Search, ShoppingBag } from 'lucide-react'

import { accentAlpha, resolveAccent } from './storefrontTheme'

type Props = {
  shopName: string
  catalogTitle: string
  catalogSubtitle: string
  welcomeMessage: string
  accentColor: string
  labels?: {
    hello: string
    search: string
    shopNow: string
    home: string
    cart: string
  }
}

export function StorefrontPreview({
  shopName,
  catalogTitle,
  catalogSubtitle,
  welcomeMessage,
  accentColor,
  labels,
}: Props) {
  const accent = resolveAccent(accentColor)
  const title = catalogTitle.trim() || shopName || 'Shop'
  const promo = welcomeMessage.trim() || catalogSubtitle.trim() || labels?.shopNow || 'Shop now'

  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[2rem] border-[6px] border-slate-800 bg-slate-800 p-1.5 shadow-2xl">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#f8f9fb]">
          <div className="flex items-center justify-between bg-white px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {title.charAt(0) || 'M'}
              </span>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400">{labels?.hello ?? 'Hello'}</p>
                <p className="truncate text-[11px] font-bold text-slate-900">{title}</p>
              </div>
            </div>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentAlpha(accent, 0.15), color: accent }}
            >
              <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>

          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-100">
              <Search className="h-3 w-3 text-slate-400" aria-hidden />
              <span className="text-[10px] text-slate-400">{labels?.search ?? 'Search…'}</span>
            </div>
          </div>

          <div
            className="mx-3 mb-3 rounded-2xl p-3 text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
            }}
          >
            <p className="text-[11px] font-bold leading-tight">{title}</p>
            <p className="mt-0.5 line-clamp-2 text-[9px] text-white/90">{promo}</p>
            <span className="mt-2 inline-block rounded-full bg-white px-2 py-0.5 text-[8px] font-bold" style={{ color: accent }}>
              {labels?.shopNow ?? 'Shop now'}
            </span>
          </div>

          <div className="px-3 pb-2">
            <div className="mb-2 flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 w-10 shrink-0 rounded-xl"
                  style={{ background: i === 0 ? accentAlpha(accent, 0.2) : '#e2e8f0' }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100">
                  <div className="flex aspect-square items-center justify-center bg-slate-100">
                    <PackageOpen className="h-5 w-5 text-slate-300" aria-hidden />
                  </div>
                  <div className="p-1.5">
                    <div className="h-2 w-full rounded bg-slate-100" />
                    <div className="mt-1 h-2 w-2/3 rounded" style={{ backgroundColor: accentAlpha(accent, 0.3) }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-t border-slate-200 bg-white px-4 py-2">
            <span className="flex-1 text-center text-[9px] font-semibold" style={{ color: accent }}>
              {labels?.home ?? 'Home'}
            </span>
            <span className="flex-1 text-center text-[9px] text-slate-400">{labels?.cart ?? 'Cart'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
