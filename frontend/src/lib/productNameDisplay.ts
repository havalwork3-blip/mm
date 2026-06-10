import type { ProductRow } from '../types/api'

/** True when the string has at least one letter or digit (not emoji-only / symbols). */
export function hasLetterOrDigit(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value)
}

/** Purchase / stock lines summary → product names only (no qty suffix). */
export function formatProductsSummaryCell(raw: string | undefined | null): string {
  const source = String(raw ?? '').trim()
  if (!source) return ''
  const parts = source
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.split('@')[0] ?? p).replace(/\s*[x×]\s*\d+\s*$/i, '').trim())
  return parts.length ? parts.join(' · ') : ''
}

export function resolveInventoryHistoryProductName(
  entry: {
    product_name: string
    event_type: 'created' | 'stock_increase' | 'sale_return'
    productId?: number
    sku?: string | null
    barcode?: string | null
  },
  productById: Map<number, ProductRow>,
  unknownLabel: string,
): string {
  let name = String(entry.product_name ?? '').trim()
  if (entry.productId != null) {
    const live = productById.get(entry.productId)
    if (live?.name?.trim()) name = live.name.trim()
  }
  if (entry.event_type === 'stock_increase') {
    name = formatProductsSummaryCell(name) || name
  }
  if (name && hasLetterOrDigit(name)) return name
  const code = String(entry.sku ?? entry.barcode ?? '').trim()
  if (code) return code
  if (entry.productId != null) return `#${entry.productId}`
  return unknownLabel
}
