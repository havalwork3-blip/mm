import { getSuperuserShopId } from './api'
import type { Me } from '../types/api'

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
