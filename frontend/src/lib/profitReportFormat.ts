import { parseMoneyString } from './usdIqdDisplay'

export function parseReportNumber(s: string): number {
  return parseMoneyString(s)
}

export function netProfitCellClass(usd: string): string {
  const n = parseReportNumber(usd)
  if (n < 0) return 'text-rose-700 dark:text-rose-400'
  if (n > 0) return 'text-emerald-800 dark:text-emerald-400'
  return 'text-slate-700 dark:text-slate-200'
}

export type ProfitLineSort = 'profit_desc' | 'profit_asc' | 'name' | 'qty_desc' | 'sale_desc'

export function sortProfitLines<T extends { product_name: string; quantity_sold: string; total_sale_price_usd: string; net_profit_usd: string }>(
  lines: T[],
  sort: ProfitLineSort,
): T[] {
  const copy = [...lines]
  copy.sort((a, b) => {
    if (sort === 'name') {
      return a.product_name.localeCompare(b.product_name, undefined, { sensitivity: 'base' })
    }
    if (sort === 'qty_desc') {
      return parseReportNumber(b.quantity_sold) - parseReportNumber(a.quantity_sold)
    }
    if (sort === 'sale_desc') {
      return parseReportNumber(b.total_sale_price_usd) - parseReportNumber(a.total_sale_price_usd)
    }
    if (sort === 'profit_asc') {
      return parseReportNumber(a.net_profit_usd) - parseReportNumber(b.net_profit_usd)
    }
    return parseReportNumber(b.net_profit_usd) - parseReportNumber(a.net_profit_usd)
  })
  return copy
}
