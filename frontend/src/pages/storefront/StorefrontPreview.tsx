import { PackageOpen, Search, ShoppingBag } from 'lucide-react'

import { resolveMediaUrl } from '../../lib/api'
import { accentAlpha, resolveAccent } from './storefrontTheme'

type Props = {
  shopName: string
  catalogTitle: string
  catalogSubtitle: string
  welcomeMessage: string
  accentColor: string
  logoUrl?: string | null
  labels?: {
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
  logoUrl,
  labels,
}: Props) {
  const accent = resolveAccent(accentColor)
  const title = catalogTitle.trim() || shopName || 'Shop'
  const promo = welcomeMessage.trim() || catalogSubtitle.trim() || labels?.shopNow || 'Shop now'
  const logoSrc = resolveMediaUrl(logoUrl ?? null)

  return (
    <div className="mx-auto w-[280px]">
      <div className="rounded-[2rem] border-[6px] border-slate-800 bg-slate-800 p-1.5 shadow-2xl">
        <div className="overflow-hidden rounded-[1.5rem] bg-[#f8f9fb]">
          <div className="flex items-center justify-between bg-white px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-bold text-white"
                style={
                  logoSrc
                    ? undefined
                    : { backgroundColor: accent }
                }
              >
                {logoSrc ? (
                  <img src={logoSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  title.charAt(0) || 'M'
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-slate-900">{title}</p>
                {catalogSubtitle.trim() ? (
                  <p className="truncate text-[9px] text-slate-400">{catalogSubtitle}</p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Search className="h-3 w-3" aria-hidden />
              </span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: accent }}
              >
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden />
              </span>
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
