import type { PublicStorefrontProduct } from '../../api/storefrontApi'

export function matchProductSearch(product: PublicStorefrontProduct, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = product.name.toLowerCase()
  if (name.includes(q)) return true
  const barcode = (product.barcode ?? '').trim().toLowerCase()
  if (barcode && (barcode.includes(q) || q.includes(barcode))) return true
  const cat = (product.category_name ?? '').toLowerCase()
  if (cat && cat.includes(q)) return true
  return false
}
