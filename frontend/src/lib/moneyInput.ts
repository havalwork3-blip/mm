export function normalizeMoneyInput(s: string): string {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

export function parseDec(s: string): number {
  const n = parseFloat(normalizeMoneyInput(s).replace(/٫/g, '.'))
  return Number.isNaN(n) ? 0 : n
}

export function usdToIqdString(usd: number, rate: number): string {
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0) return ''
  return String(Math.round(usd * rate))
}

export function iqdToUsdString(iqd: number, rate: number): string {
  if (!Number.isFinite(iqd) || iqd <= 0 || !Number.isFinite(rate) || rate <= 0) return ''
  const usd = iqd / rate
  return usd.toFixed(4).replace(/\.?0+$/, '')
}
