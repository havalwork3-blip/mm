/** Parse decimal money string (handles trailing minus in RTL-pasted values). */
export function parseMoneyString(s: string): number {
  let t = String(s).replace(/[\s,،\u066C]/g, '').trim()
  if (t.endsWith('-')) {
    t = `-${t.slice(0, -1)}`
  }
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** IQD integer approx using shop rate (IQD per 1 USD); null if no rate. */
export function iqdIntegerStringFromUsd(usdStr: string, rateStr: string): string | null {
  const r = parseFloat(String(rateStr).replace(/,/g, '').trim())
  if (!String(rateStr ?? '').trim() || !(r > 0) || !Number.isFinite(r)) {
    return null
  }
  const usd = parseMoneyString(usdStr)
  if (!Number.isFinite(usd)) return null
  return Math.round(usd * r).toLocaleString('en-US')
}
