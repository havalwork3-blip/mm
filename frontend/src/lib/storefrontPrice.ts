export function parsePrice(value: string | number | null | undefined): number {
  if (value == null) return 0
  const n = Number.parseFloat(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Unit price after % discount when cart qty >= min threshold. */
export function effectiveOnlineUnitPrice(
  basePrice: string,
  quantity: number,
  discountPercent: number,
  discountMinQty: number,
): number {
  const base = parsePrice(basePrice)
  const qty = Math.max(1, Math.floor(quantity))
  const pct = Math.max(0, Math.min(100, discountPercent))
  const minQty = Math.max(1, Math.floor(discountMinQty))
  if (pct > 0 && qty >= minQty) {
    return base * (1 - pct / 100)
  }
  return base
}

export function formatPriceAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}
