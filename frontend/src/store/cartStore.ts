import { create } from 'zustand'

import type { PublicStorefrontProduct } from '../api/storefrontApi'
import { effectiveOnlineUnitPrice, parsePrice } from '../lib/storefrontPrice'

export type CartLine = {
  productId: number
  name: string
  unitBasePrice: string
  discountPercent: number
  discountMinQty: number
  imageUrl: string | null
  quantity: number
}

type CartState = {
  lines: CartLine[]
  addItem: (product: PublicStorefrontProduct, quantity?: number) => void
  removeItem: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
}

function productPricing(product: PublicStorefrontProduct) {
  const base =
    product.online_base_price != null && String(product.online_base_price).trim() !== ''
      ? String(product.online_base_price)
      : product.sell_price
  const discountPercent = Number.parseFloat(String(product.online_discount_percent ?? 0))
  const discountMinQty = Math.max(
    1,
    Number.parseInt(String(product.online_discount_min_quantity ?? 1), 10) || 1,
  )
  return {
    unitBasePrice: base,
    discountPercent: Number.isFinite(discountPercent) ? discountPercent : 0,
    discountMinQty,
  }
}

export function cartLineUnitPrice(line: CartLine): number {
  return effectiveOnlineUnitPrice(
    line.unitBasePrice,
    line.quantity,
    line.discountPercent,
    line.discountMinQty,
  )
}

export function cartLineTotal(line: CartLine): number {
  return cartLineUnitPrice(line) * line.quantity
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + cartLineTotal(line), 0)
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0)
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  addItem: (product, quantity = 1) => {
    const qty = Math.max(1, Math.floor(quantity))
    const imageUrl = product.image_url ?? null
    const pricing = productPricing(product)
    set((state) => {
      const idx = state.lines.findIndex((l) => l.productId === product.id)
      if (idx >= 0) {
        const next = [...state.lines]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty }
        return { lines: next }
      }
      return {
        lines: [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            imageUrl,
            quantity: qty,
            ...pricing,
          },
        ],
      }
    })
  },

  removeItem: (productId) => {
    set((state) => ({
      lines: state.lines.filter((l) => l.productId !== productId),
    }))
  },

  setQuantity: (productId, quantity) => {
    const qty = Math.floor(quantity)
    if (qty < 1) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      lines: state.lines.map((l) =>
        l.productId === productId ? { ...l, quantity: qty } : l,
      ),
    }))
  },

  clearCart: () => set({ lines: [] }),
}))
