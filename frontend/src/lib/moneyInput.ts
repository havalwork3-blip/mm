export function normalizeMoneyInput(s: string): string {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

export function parseDec(s: string): number {
  const n = parseFloat(normalizeMoneyInput(s).replace(/٫/g, '.'))
  return Number.isNaN(n) ? 0 : n
}

/** At most 2 digits after the decimal point; trims trailing zeros (e.g. 10.50 → 10.5, 10.00 → 10). */
export function formatMoney2(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (trimmed === '') return ''
  const n = typeof raw === 'number' ? raw : parseDec(trimmed)
  if (!Number.isFinite(n)) return trimmed
  const s = n.toFixed(2).replace(/\.?0+$/, '')
  return s === '' ? '0' : s
}

export function usdToIqdString(usd: number, rate: number): string {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0) return ''
  return String(Math.round(usd * rate))
}

export function iqdToUsdString(iqd: number, rate: number): string {
  if (!Number.isFinite(iqd) || iqd <= 0 || !Number.isFinite(rate) || rate <= 0) return ''
  return formatMoney2(iqd / rate)
}
