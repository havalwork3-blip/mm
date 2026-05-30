import { getSuperuserShopId, setSuperuserShopId } from './api'
import type { Me, ShopRow } from '../types/api'

/** Superuser shop scope saved in memory or localStorage (not the dashboard modal draft). */
export function getPersistedSuperuserShopId(): string {
  return (getSuperuserShopId()?.trim() || readPosShopIdFromStorage() || '').trim()
}

export function readPosShopIdFromStorage(): string | null {
  try {
    return localStorage.getItem('pos_shop_id')?.trim() || null
  } catch {
    return null
  }
}

/**
 * Ensure `pos_shop_id` points at an existing shop (clears stale ids after DB reset).
 * Returns the active shop id string, or null when no shops exist.
 */
export function reconcilePosShopId(shops: ShopRow[]): string | null {
  const ids = new Set(shops.map((s) => String(s.id)))
  try {
    const stored = localStorage.getItem('pos_shop_id')?.trim() || null
    if (stored && ids.has(stored)) {
      setSuperuserShopId(stored)
      return stored
    }
    const fallback = shops[0] ? String(shops[0].id) : null
    if (fallback) {
      localStorage.setItem('pos_shop_id', fallback)
      setSuperuserShopId(fallback)
    } else {
      localStorage.removeItem('pos_shop_id')
      setSuperuserShopId(null)
    }
    return fallback
  } catch {
    const fallback = shops[0] ? String(shops[0].id) : null
    if (fallback) setSuperuserShopId(fallback)
    else setSuperuserShopId(null)
    return fallback
  }
}

/** Active tenant shop for POS, sales list, and other shop-scoped APIs. */
export function resolveActiveShopId(
  me: Me | null,
  shopImpersonation?: string | null,
): number | null {
  if (!me) return null
  if (me.is_superuser) {
    const raw = (shopImpersonation ?? readPosShopIdFromStorage() ?? '').trim()
    if (raw) {
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    return me.shop
  }
  return me.shop
}
