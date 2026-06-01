import { apiJson, getSuperuserShopId, setSuperuserShopId } from './api'
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
 * Validate `pos_shop_id` against the shop list (clears stale ids after DB reset).
 * Does not auto-select a shop — superusers may keep "no shop" until they choose one.
 */
export function reconcilePosShopId(shops: ShopRow[]): string | null {
  const ids = new Set(shops.map((s) => String(s.id)))
  try {
    const stored = localStorage.getItem('pos_shop_id')?.trim() || null
    if (stored && ids.has(stored)) {
      setSuperuserShopId(stored)
      return stored
    }
    localStorage.removeItem('pos_shop_id')
    setSuperuserShopId(null)
    return null
  } catch {
    setSuperuserShopId(null)
    return null
  }
}

/** Superuser: fetch shops and fix stale `pos_shop_id` before tenant API calls. */
export async function syncSuperuserShopScope(): Promise<string | null> {
  try {
    const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/', {
      omitShopScope: true,
    })
    const list = Array.isArray(data) ? data : data.results
    return reconcilePosShopId(list)
  } catch {
    try {
      localStorage.removeItem('pos_shop_id')
    } catch {
      /* ignore */
    }
    setSuperuserShopId(null)
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
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return me.shop
}
