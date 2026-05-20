import { create } from 'zustand'

import type { PublicStorefrontProduct } from '../api/storefrontApi'

export type CartLine = {
  productId: number
  name: string
  sellPrice: string
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

function parsePrice(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

export function cartLineTotal(line: CartLine): number {
  return parsePrice(line.sellPrice) * line.quantity
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
            sellPrice: product.sell_price,
            imageUrl,
            quantity: qty,
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
