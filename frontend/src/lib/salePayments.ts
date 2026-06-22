import type { SaleListRow } from '../types/api'

/** USD + IQD converted — same total used for remaining balance on each receipt. */
export function salePaidUsdEquivalent(sale: Pick<SaleListRow, 'amount_paid_usd' | 'amount_paid_iqd' | 'exchange_rate_usd_to_iqd'>): number {
  const rate = parseFloat(String(sale.exchange_rate_usd_to_iqd))
  const paidUsd = parseFloat(String(sale.amount_paid_usd)) || 0
  const paidIqd = parseFloat(String(sale.amount_paid_iqd)) || 0
  if (!Number.isFinite(rate) || rate <= 0) return paidUsd
  return paidUsd + paidIqd / rate
}
