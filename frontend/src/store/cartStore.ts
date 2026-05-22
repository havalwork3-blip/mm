import { create } from 'zustand'

import type { PublicStorefrontProduct, StorefrontDeliveryZone } from '../api/storefrontApi'
import { effectiveOnlineUnitPrice } from '../lib/storefrontPrice'

export type CartLine = {
  productId: number
  name: string
  unitBasePrice: string
  discountPercent: number
  discountMinQty: number
  imageUrl: string | null
  quantity: number
}

type PersistedCart = {
  lines: CartLine[]
  deliveryZoneId: number | null
}

const STORAGE_KEY = 'sf_cart_v1'

type CartState = {
  shopId: number | null
  lines: CartLine[]
  deliveryZoneId: number | null
  showViewCartNudge: boolean
  bindShop: (shopId: number) => void
  addItem: (product: PublicStorefrontProduct, quantity?: number) => void
  removeItem: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  setDeliveryZoneId: (zoneId: number | null) => void
  dismissViewCartNudge: () => void
  clearCart: () => void
}

function readStorage(shopKey: string): PersistedCart | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const block = parsed[shopKey]
    if (!block || typeof block !== 'object') return null
    const o = block as PersistedCart
    if (!Array.isArray(o.lines)) return null
    return {
      lines: o.lines.filter(
        (l) =>
          l &&
          typeof l === 'object' &&
          Number.isFinite((l as CartLine).productId) &&
          (l as CartLine).quantity > 0,
      ) as CartLine[],
      deliveryZoneId:
        o.deliveryZoneId != null && Number.isFinite(o.deliveryZoneId)
          ? Number(o.deliveryZoneId)
          : null,
    }
  } catch {
    return null
  }
}

function writeStorage(shopKey: string, data: PersistedCart) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    parsed[shopKey] = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    /* quota / private mode */
  }
}

function persist(shopId: number | null, lines: CartLine[], deliveryZoneId: number | null) {
  if (shopId == null) return
  writeStorage(String(shopId), { lines: cartActiveLines(lines), deliveryZoneId })
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

/** Lines with quantity > 0 — used for totals, badge, and checkout. */
export function cartActiveLines(lines: CartLine[]): CartLine[] {
  return lines.filter((l) => l.quantity > 0)
}

export function cartSubtotal(lines: CartLine[]): number {
  return cartActiveLines(lines).reduce((sum, line) => sum + cartLineTotal(line), 0)
}

/** @deprecated use cartSubtotal */
export function cartTotal(lines: CartLine[]): number {
  return cartSubtotal(lines)
}

export function parseDeliveryFreeMinUsd(raw: string | null | undefined): number | null {
  if (raw == null || String(raw).trim() === '') return null
  const n = Number.parseFloat(String(raw))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function cartDeliveryFee(
  zones: StorefrontDeliveryZone[],
  zoneId: number | null,
  subtotalUsd: number,
  freeDeliveryMinUsd: number | null = null,
): number {
  if (zoneId == null) return 0
  const zone = zones.find((z) => z.id === zoneId)
  if (!zone) return 0
  const n = Number.parseFloat(String(zone.delivery_fee_usd))
  const base = Number.isFinite(n) && n > 0 ? n : 0
  if (freeDeliveryMinUsd != null && subtotalUsd >= freeDeliveryMinUsd) return 0
  return base
}

export function cartGrandTotal(
  lines: CartLine[],
  zones: StorefrontDeliveryZone[],
  zoneId: number | null,
  freeDeliveryMinUsd: number | null = null,
): number {
  const sub = cartSubtotal(lines)
  return sub + cartDeliveryFee(zones, zoneId, sub, freeDeliveryMinUsd)
}

export function cartItemCount(lines: CartLine[]): number {
  return cartActiveLines(lines).reduce((sum, line) => sum + line.quantity, 0)
}

export const useCartStore = create<CartState>((set, get) => ({
  shopId: null,
  lines: [],
  deliveryZoneId: null,
  showViewCartNudge: false,

  bindShop: (shopId) => {
    const saved = readStorage(String(shopId))
    const lines = saved?.lines ?? []
    const deliveryZoneId = saved?.deliveryZoneId ?? null
    const cur = get()
    if (
      cur.shopId === shopId &&
      cur.deliveryZoneId === deliveryZoneId &&
      cur.lines.length === lines.length &&
      cur.lines.every((l, i) => l.productId === lines[i]?.productId && l.quantity === lines[i]?.quantity)
    ) {
      return
    }
    set({
      shopId,
      lines,
      deliveryZoneId,
      showViewCartNudge: false,
    })
  },

  addItem: (product, quantity = 1) => {
    const qty = Math.max(1, Math.floor(quantity))
    const imageUrl = product.image_url ?? null
    const pricing = productPricing(product)
    set((state) => {
      const idx = state.lines.findIndex((l) => l.productId === product.id)
      let lines: CartLine[]
      if (idx >= 0) {
        const next = [...state.lines]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty }
        lines = next
      } else {
        lines = [
          ...state.lines,
          {
            productId: product.id,
            name: product.name,
            imageUrl,
            quantity: qty,
            ...pricing,
          },
        ]
      }
      persist(state.shopId, lines, state.deliveryZoneId)
      return { lines, showViewCartNudge: true }
    })
  },

  removeItem: (productId) => {
    set((state) => {
      const lines = state.lines.filter((l) => l.productId !== productId)
      persist(state.shopId, lines, state.deliveryZoneId)
      return { lines }
    })
  },

  setQuantity: (productId, quantity) => {
    const qty = Math.max(0, Math.floor(quantity))
    set((state) => {
      const idx = state.lines.findIndex((l) => l.productId === productId)
      if (idx < 0) return state
      const prevQty = state.lines[idx].quantity
      const next = [...state.lines]
      next[idx] = { ...next[idx], quantity: qty }
      persist(state.shopId, next, state.deliveryZoneId)
      const addedMore = qty > prevQty && qty > 0
      return {
        lines: next,
        showViewCartNudge: addedMore ? true : state.showViewCartNudge,
      }
    })
  },

  setDeliveryZoneId: (zoneId) => {
    set((state) => {
      persist(state.shopId, state.lines, zoneId)
      return { deliveryZoneId: zoneId }
    })
  },

  dismissViewCartNudge: () => set({ showViewCartNudge: false }),

  clearCart: () => {
    const { shopId, deliveryZoneId } = get()
    persist(shopId, [], deliveryZoneId)
    set({ lines: [], showViewCartNudge: false })
  },
}))
