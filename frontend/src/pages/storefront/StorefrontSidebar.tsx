import {
  Globe,
  Heart,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  MapPin,
  Moon,
  Phone,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import { useLocale } from '../../context/LocaleContext'
import { isStorefrontMode } from '../../lib/storefrontConfig'
import { socialPlatformLabel } from '../../lib/storefrontSocial'
import { useStorefrontFavoritesStore } from '../../store/storefrontFavoritesStore'
import { useStorefrontCatalog } from './storefrontCatalogContext'
import { storefrontStrings } from './storefrontStrings'
import { storefrontHeaderSubtitle, storefrontHeaderTitle } from './storefrontDisplay'
import { useStorefrontShop } from './StorefrontShopContext'
import { useStorefrontPrice } from './storefrontPriceContext'
import { useStorefrontTheme } from './storefrontThemeContext'
import { StorefrontSocialIcon } from './StorefrontSocialIcon'
import type { Lang } from '../../i18n/strings'
import type { StorefrontTheme } from './storefrontThemeContext'

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
  const { setLang } = useLocale()
  const s = storefrontStrings(lang)
  const { shopName, appearance } = useStorefrontShop()
  const sidebarTitle = storefrontHeaderTitle(appearance, shopName)
  const sidebarSubtitle = storefrontHeaderSubtitle(appearance)
  const { currency, setCurrency } = useStorefrontPrice()
  const { theme, setTheme } = useStorefrontTheme()
  const { backToCategories, showAllProducts, showCollection } = useStorefrontCatalog()
  const { shopId } = useStorefrontShop()
  const favCount = useStorefrontFavoritesStore((st) =>
    shopId != null ? st.count(shopId) : 0,
  )
  const socials = appearance.social_links ?? []
  const isDark = theme === 'dark'
  const [openSettings, setOpenSettings] = useState<'lang' | 'appearance' | null>(null)

  useEffect(() => {
    if (!open) setOpenSettings(null)
  }, [open])

  const toggleSettings = (panel: 'lang' | 'appearance') => {
    setOpenSettings((prev) => (prev === panel ? null : panel))
  }

  const settingsIconCls = (active: boolean) =>
    [
      'flex h-11 w-11 items-center justify-center rounded-xl transition',
      active ? 'text-white shadow-sm' : 'sf-sidebar-pill',
    ].join(' ')

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    [
      'sf-sidebar-nav flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
      isActive ? 'text-white shadow-sm' : '',
    ].join(' ')

  const navBtnCls =
    'sf-sidebar-nav flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition'

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
            <p className="sf-sidebar-title truncate text-sm font-extrabold">
              {sidebarTitle || shopName}
            </p>
            {sidebarSubtitle ? (
              <p className="sf-sidebar-muted truncate text-[11px]">{sidebarSubtitle}</p>
            ) : null}
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
            className={navBtnCls}
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
            className={navBtnCls}
          >
            <LayoutGrid className="h-4 w-4" />
            {s.scrollToProducts}
          </button>
          <button
            type="button"
            onClick={() => {
              showCollection('favorites')
              onClose()
            }}
            className={navBtnCls}
          >
            <Heart className="h-4 w-4" />
            {s.myFavorites}
            {favCount > 0 ? (
              <span
                className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {favCount > 99 ? '99+' : favCount}
              </span>
            ) : null}
          </button>
          <button type="button" onClick={() => { onOpenCart(); onClose() }} className={navBtnCls}>
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

        <div className="shrink-0 space-y-4 border-t border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSettings('lang')}
              className={settingsIconCls(openSettings === 'lang')}
              style={openSettings === 'lang' ? { backgroundColor: accent } : undefined}
              aria-label={s.language}
              aria-expanded={openSettings === 'lang'}
              title={s.language}
            >
              <Globe className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => toggleSettings('appearance')}
              className={settingsIconCls(openSettings === 'appearance')}
              style={openSettings === 'appearance' ? { backgroundColor: accent } : undefined}
              aria-label={s.appearance}
              aria-expanded={openSettings === 'appearance'}
              title={s.appearance}
            >
              {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </button>
          </div>

          {openSettings === 'lang' ? (
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={s.language}
            >
              {(['ku', 'ar', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={[
                    'rounded-lg px-2.5 py-1.5 text-xs font-bold transition',
                    lang === code ? 'text-white shadow-sm' : 'sf-sidebar-pill',
                  ].join(' ')}
                  style={lang === code ? { backgroundColor: accent } : undefined}
                >
                  {code === 'ku' ? 'کوردی' : code === 'ar' ? 'عربي' : 'EN'}
                </button>
              ))}
            </div>
          ) : null}

          {openSettings === 'appearance' ? (
            <div className="flex gap-1.5" role="group" aria-label={s.appearance}>
              {(['light', 'dark'] as StorefrontTheme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition',
                    theme === t ? 'text-white shadow-sm' : 'sf-sidebar-pill',
                  ].join(' ')}
                  style={theme === t ? { backgroundColor: accent } : undefined}
                >
                  {t === 'light' ? <Sun className="h-3.5 w-3.5" aria-hidden /> : <Moon className="h-3.5 w-3.5" aria-hidden />}
                  {t === 'light' ? s.lightMode : s.darkMode}
                </button>
              ))}
            </div>
          ) : null}

          <div>
            <p className="sf-sidebar-muted mb-2 text-[10px] font-bold uppercase tracking-wider">
              {s.currencyLabel}
            </p>
            <div className="flex gap-1.5">
              {(['usd', 'iqd'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={[
                    'flex-1 rounded-xl py-2 text-xs font-bold transition',
                    currency === code ? 'text-white shadow-sm' : 'sf-sidebar-pill',
                  ].join(' ')}
                  style={currency === code ? { backgroundColor: accent } : undefined}
                >
                  {code === 'usd' ? s.usd : s.iqd}
                </button>
              ))}
            </div>
          </div>

          {socials.length > 0 ? (
            <div className="pt-1">
              <p className="sf-sidebar-muted mb-2.5 text-center text-[10px] font-bold uppercase tracking-wider">
                {s.followUs}
              </p>
              <div className="sf-social-row flex items-center justify-center gap-2">
                {socials.map((link) => (
                  <a
                    key={`${link.platform}-${link.url}`}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="sf-social-btn group"
                    style={{ ['--sf-social-accent' as string]: accent }}
                    title={socialPlatformLabel(link.platform, s.socialPlatforms)}
                    aria-label={socialPlatformLabel(link.platform, s.socialPlatforms)}
                  >
                    <span className="sf-social-icon-circle flex h-11 w-11 items-center justify-center rounded-full shadow-md ring-1 transition group-hover:scale-110 group-hover:shadow-lg">
                      <StorefrontSocialIcon platform={link.platform} className="h-5 w-5" />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
