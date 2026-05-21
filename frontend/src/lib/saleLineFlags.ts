import type { SaleLineRow } from '../types/api'

export function saleLineFlagsFromRow(ln: {
  unit_price_usd: string
  unit_buy_price_usd?: string
  quantity?: number
  sold_at_zero?: boolean
  sold_at_loss?: boolean
}): { soldAtZero: boolean; soldAtLoss: boolean } {
  if (ln.sold_at_zero !== undefined || ln.sold_at_loss !== undefined) {
    return {
      soldAtZero: Boolean(ln.sold_at_zero),
      soldAtLoss: Boolean(ln.sold_at_loss),
    }
  }
  const price = Number.parseFloat(String(ln.unit_price_usd).replace(/,/g, ''))
  const buy = Number.parseFloat(String(ln.unit_buy_price_usd ?? '0').replace(/,/g, ''))
  const soldAtZero = Number.isFinite(price) && price === 0
  const soldAtLoss =
    soldAtZero && buy > 0 || (Number.isFinite(price) && Number.isFinite(buy) && buy > 0 && price < buy)
  return { soldAtZero, soldAtLoss }
}

export function saleHasLossLines(lines: SaleLineRow[]): boolean {
  return lines.some((ln) => saleLineFlagsFromRow(ln).soldAtLoss)
}
