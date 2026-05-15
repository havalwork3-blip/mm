export function formatMoney(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function usdToIqd(usd: string, rate: number | null) {
  const u = parseFloat(usd)
  if (Number.isNaN(u) || rate === null || Number.isNaN(rate)) return '—'
  return Math.round(u * rate).toLocaleString()
}
