import { formatUsd } from '../pages/storefront/storefrontStrings'

export type StorefrontCurrencyPref = 'usd' | 'iqd'

export function parseExchangeRate(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = parseFloat(String(raw))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatStorefrontPrice(
  usdAmount: number,
  pref: StorefrontCurrencyPref,
  rate: number | null,
  labels: { usd: string; iqd: string },
): string {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return '—'
  if (pref === 'usd') {
    return `$${formatUsd(usdAmount)} ${labels.usd}`
  }
  if (rate == null || rate <= 0) {
    return `$${formatUsd(usdAmount)} ${labels.usd}`
  }
  const iqd = Math.round(usdAmount * rate)
  return `${iqd.toLocaleString('en-US')} ${labels.iqd}`
}

export function currencyPrefStorageKey(shopId: number | null): string {
  return shopId != null ? `sf_currency_${shopId}` : 'sf_currency'
}

export function readCurrencyPref(
  shopId: number | null,
  shopDefault: 'usd' | 'iqd' | 'both',
): StorefrontCurrencyPref {
  try {
    const saved = localStorage.getItem(currencyPrefStorageKey(shopId))
    if (saved === 'usd' || saved === 'iqd') return saved
  } catch {
    /* ignore */
  }
  if (shopDefault === 'iqd') return 'iqd'
  return 'usd'
}

export function writeCurrencyPref(shopId: number | null, pref: StorefrontCurrencyPref) {
  try {
    localStorage.setItem(currencyPrefStorageKey(shopId), pref)
  } catch {
    /* ignore */
  }
}
