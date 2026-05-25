/**
 * Public customer storefront (e.g. mmiraq.com) vs merchant dashboard (dashboard.mmiraq.com).
 */

/** Base domain appended when admin enters only a shop label (e.g. `haval` → `haval.mmiraq.com`). */
export const STOREFRONT_BASE_DOMAIN = 'mmiraq.com'

/** Public marketing site (QR landing, not the merchant dashboard host). */
export const PUBLIC_SITE_ORIGIN =
  (import.meta.env.VITE_PUBLIC_SITE_ORIGIN as string | undefined)?.trim() ||
  `https://${STOREFRONT_BASE_DOMAIN}`

/** Canonical URL for the global /qr-code page shown on printed QR codes. */
export function getQrLandingPageUrl(): string {
  if (typeof window === 'undefined') {
    return new URL('/qr-code', PUBLIC_SITE_ORIGIN).href
  }
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1') {
    return new URL('/qr-code', window.location.origin).href
  }
  return new URL('/qr-code', PUBLIC_SITE_ORIGIN).href
}

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Normalize storefront host from admin form (mirrors backend/shops/storefront_hosts.py). */
export function normalizeStorefrontHostInput(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^\.+|\.+$/g, '')
  if (!s) return ''
  if (!s.includes('.') && LABEL_RE.test(s)) {
    s = `${s}.${STOREFRONT_BASE_DOMAIN}`
  }
  return s
}

const DASHBOARD_HOSTS = new Set(['dashboard.mmiraq.com'])

export function isStorefrontMode(): boolean {
  if (import.meta.env.VITE_STOREFRONT_MODE === '1') return true
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  if (DASHBOARD_HOSTS.has(host)) return false
  if (host.endsWith('.mmiraq.com') && host !== 'mmiraq.com' && host !== 'www.mmiraq.com') {
    return true
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return window.location.pathname.startsWith('/store')
  }
  return false
}
