import type { SaleListRow, SaleReturnResponse } from '../types/api'

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
  let gross = 0
  for (const ln of sale.lines) {
    gross += Number(ln.quantity) * parseUsdAmount(ln.unit_price_usd)
    const qty = Math.max(0, Math.floor(Number(returnQuantities[ln.id] ?? '0')))
    if (qty <= 0) continue
    total += qty * parseUsdAmount(ln.unit_price_usd)
  }
  // Returned lines carry their share of the invoice discount (same rule as the server).
  const discount = parseUsdAmount(sale.invoice_discount_usd)
  const ratio = gross > 0 ? Math.min(1, Math.max(0, 1 - discount / gross)) : 1
  return total * ratio
}

/**
 * Message after a return: how much cash to hand back and how much was taken off the
 * customer's debt instead (a credit sale's unpaid part is never paid out in cash).
 */
export function saleReturnResultMessage(
  res: SaleReturnResponse,
  t: (key: string) => string,
  format: (value: string) => string,
): string {
  const cash = parseUsdAmount(res.cash_refund_usd ?? res.total_refund_usd)
  const debt = parseUsdAmount(res.debt_reduced_usd ?? '0')
  if (cash > DEBT_EPSILON && debt > DEBT_EPSILON) {
    return t('salesReturns.successSplit')
      .replace('{cash}', format(String(cash)))
      .replace('{debt}', format(String(debt)))
  }
  if (debt > DEBT_EPSILON) return t('salesReturns.successDebtReduction').replace('{usd}', format(String(debt)))
  return t('pos.returnSuccess').replace('{usd}', format(String(cash)))
}
