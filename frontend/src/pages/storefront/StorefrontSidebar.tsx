import {
  ExternalLink,
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
import { socialPlatformLabel } from '../../lib/storefrontSocial'
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

function SocialIcon({ platform }: { platform: string }) {
  return (
    <span className="sf-sidebar-social-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
      {platform.charAt(0).toUpperCase()}
    </span>
  )
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
  const socials = appearance.social_links ?? []

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    [
      'sf-sidebar-nav flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
      isActive ? 'text-white shadow-sm' : '',
    ].join(' ')

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]"
        aria-label={s.close}
        onClick={onClose}
      />
      <aside className="sf-sidebar-panel fixed inset-y-0 start-0 z-[60] flex w-[min(18rem,88vw)] flex-col border-e shadow-2xl sm:w-72">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <p className="sf-sidebar-title truncate text-sm font-extrabold">{shopName}</p>
            <p className="sf-sidebar-muted truncate text-[11px]">
              {appearance.shop_address || appearance.catalog_subtitle || s.shopTagline}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="sf-sidebar-nav flex h-9 w-9 items-center justify-center rounded-xl"
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
            className="sf-sidebar-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
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
            className="sf-sidebar-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
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
            className="sf-sidebar-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
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

          <p className="sf-sidebar-muted px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider">
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

        {socials.length > 0 ? (
          <div className="shrink-0 border-t border-slate-100 p-4">
            <p className="sf-sidebar-muted mb-3 text-[10px] font-bold uppercase tracking-wider">
              {s.followUs}
            </p>
            <ul className="flex flex-wrap gap-2">
              {socials.map((link) => (
                <li key={`${link.platform}-${link.url}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="sf-sidebar-social-chip group flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition"
                    title={socialPlatformLabel(link.platform, s.socialPlatforms)}
                  >
                    <SocialIcon platform={link.platform} />
                    <span className="max-w-[6rem] truncate">
                      {socialPlatformLabel(link.platform, s.socialPlatforms)}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-70" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </>
  )
}
