import type { SaleListRow } from '../types/api'

export type SaleReturnRefundMethod = 'cash' | 'debt_reduction'

const DEBT_EPSILON = 0.0001

export function parseUsdAmount(value: string | undefined | null): number {
  const n = Number(String(value ?? '0').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function saleIsCredit(sale: Pick<SaleListRow, 'is_credit_sale' | 'unpaid_balance_usd'>): boolean {
  if (sale.is_credit_sale === true) return true
  return parseUsdAmount(sale.unpaid_balance_usd) > DEBT_EPSILON
}

export function customerHasOutstandingDebt(
  sale: Pick<SaleListRow, 'customer_outstanding_balance_usd'>,
): boolean {
  return parseUsdAmount(sale.customer_outstanding_balance_usd) > DEBT_EPSILON
}

export function estimateReturnRefundUsd(
  sale: SaleListRow,
  returnQuantities: Record<number, string>,
): number {
  let total = 0
  for (const ln of sale.lines) {
    const qty = Math.max(0, Math.floor(Number(returnQuantities[ln.id] ?? '0')))
    if (qty <= 0) continue
    total += qty * parseUsdAmount(ln.unit_price_usd)
  }
  return total
}
