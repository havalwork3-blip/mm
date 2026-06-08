/** API stores IQD per 1 USD; forms display IQD per 100 USD. */
export const IQD_PER_100_USD_DISPLAY_UNIT = 100

/** Below this (IQD per 100 USD) the rate is almost certainly a typo (e.g. 154 vs 154000). */
export const MIN_PLAUSIBLE_IQD_PER_100_USD = 50_000

/** Normalize numeric input: Arabic/Persian digits, separators, decimal mark. */
export function normalizeNumericInput(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/[\s,،\u066C]/g, '')
    .trim()
}

export function parseNumericInput(s: string): number | null {
  const normalized = normalizeNumericInput(s)
  if (!normalized) return null
  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}

/** IQD per 1 USD (API) → IQD per 100 USD (UI). */
export function iqdPer100FromApiRate(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') return ''
  const n = typeof value === 'number' ? value : parseNumericInput(String(value))
  if (n == null || !(n > 0)) return ''
  return String(Math.round(n * IQD_PER_100_USD_DISPLAY_UNIT))
}

/** IQD per 100 USD (UI input) → IQD per 1 USD (API). */
export function apiRateFromIqdPer100Input(input: string): number | null {
  const n = parseNumericInput(input)
  if (n == null || !(n > 0)) return null
  return n / IQD_PER_100_USD_DISPLAY_UNIT
}

export function parseApiExchangeRate(raw: string | number | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = typeof raw === 'number' ? raw : parseNumericInput(String(raw))
  return n != null && n > 0 ? n : null
}

export function usdToIqdAmount(usd: number, apiRate: number): number {
  if (!Number.isFinite(usd) || !Number.isFinite(apiRate) || apiRate <= 0) return 0
  return Math.round(usd * apiRate)
}

export function iqdToUsdAmount(iqd: number, apiRate: number): number {
  if (!Number.isFinite(iqd) || !Number.isFinite(apiRate) || apiRate <= 0) return 0
  return iqd / apiRate
}

export function formatIqdInteger(iqd: number): string {
  return Math.round(iqd).toLocaleString('en-US')
}

export function isPlausibleIqdPer100(iqdPer100: number): boolean {
  return Number.isFinite(iqdPer100) && iqdPer100 >= MIN_PLAUSIBLE_IQD_PER_100_USD
}
