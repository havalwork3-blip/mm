import type { PublicStorefrontProduct, ProductUnavailableReason } from '../../api/storefrontApi'

export function isProductAvailable(product: PublicStorefrontProduct): boolean {
  if (typeof product.is_available === 'boolean') return product.is_available
  return true
}

export function unavailableLabel(
  product: PublicStorefrontProduct,
  labels: { outOfStock: string; discontinued: string; unavailable: string },
): string {
  const reason = product.unavailable_reason
  if (reason === 'discontinued') return labels.discontinued
  if (reason === 'out_of_stock') return labels.outOfStock
  return labels.unavailable
}

export function sortProductsAvailableFirst<T extends { product: PublicStorefrontProduct }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const av = Number(isProductAvailable(b.product)) - Number(isProductAvailable(a.product))
    if (av !== 0) return av
    return a.product.name.localeCompare(b.product.name)
  })
}

export type { ProductUnavailableReason }
