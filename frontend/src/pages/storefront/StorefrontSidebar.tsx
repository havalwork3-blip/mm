import {
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  MapPin,
  Phone,
  ShoppingBag,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { isStorefrontMode } from '../../lib/storefrontConfig'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { useStorefrontShop } from './StorefrontShopContext'
import type { Lang } from '../../i18n/strings'

type Props = {
  open: boolean
  onClose: () => void
  accent: string
  lang: Lang
  cartCount: number
  onOpenCart: () => void
}

function navBase(path: string) {
  return isStorefrontMode() ? `/${path}` : `/store/${path}`
}

export function StorefrontSidebar({
  open,
  onClose,
  accent,
  lang,
  cartCount,
  onOpenCart,
}: Props) {
  const s = storefrontStrings(lang)
  const { shopName, appearance } = useStorefrontShop()
  const { backToCategories, showAllProducts } = useStorefrontCatalog()

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
      isActive ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
    ].join(' ')

  const panel = (
    <aside className="flex h-full w-[min(18rem,85vw)] flex-col border-e border-slate-100 bg-white shadow-xl lg:w-64 lg:shadow-none">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-900">{shopName}</p>
          <p className="truncate text-[11px] text-slate-500">
            {appearance.shop_address || appearance.catalog_subtitle || s.shopTagline}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label={s.close}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={s.menu}>
        <button
          type="button"
          onClick={() => {
            backToCategories()
            onClose()
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <Home className="h-4 w-4" />
          {s.home}
        </button>
        <button
          type="button"
          onClick={() => {
            showAllProducts()
            onClose()
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <LayoutGrid className="h-4 w-4" />
          {s.scrollToProducts}
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenCart()
            onClose()
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ShoppingBag className="h-4 w-4" />
          {s.cart}
          {cartCount > 0 ? (
            <span
              className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: accent }}
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          ) : null}
        </button>

        <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {s.menuInfo}
        </p>
        <NavLink
          to={navBase('contact')}
          onClick={onClose}
          className={linkCls}
          style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
        >
          <Phone className="h-4 w-4" />
          {s.contactUs}
        </NavLink>
        <NavLink
          to={navBase('about')}
          onClick={onClose}
          className={linkCls}
          style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
        >
          <Info className="h-4 w-4" />
          {s.aboutUs}
        </NavLink>
        <NavLink
          to={navBase('faq')}
          onClick={onClose}
          className={linkCls}
          style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
        >
          <HelpCircle className="h-4 w-4" />
          {s.faq}
        </NavLink>
        {appearance.location_url || appearance.shop_address ? (
          <NavLink
            to={navBase('location')}
            onClick={onClose}
            className={linkCls}
            style={({ isActive }) => (isActive ? { backgroundColor: accent } : undefined)}
          >
            <MapPin className="h-4 w-4" />
            {s.shopLocation}
          </NavLink>
        ) : null}
      </nav>
    </aside>
  )

  return (
    <>
      <div className="hidden shrink-0 lg:block lg:w-64">{panel}</div>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            aria-label={s.close}
            onClick={onClose}
          />
          <div className="fixed inset-y-0 start-0 z-[60] lg:hidden">{panel}</div>
        </>
      ) : null}
    </>
  )
}
