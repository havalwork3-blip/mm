import { create } from 'zustand'

const STORAGE_KEY = 'sf_recent_v1'
const MAX_PER_SHOP = 12

/** Stable empty list — avoids infinite re-renders in Zustand selectors. */
export const EMPTY_RECENT_IDS: number[] = []

type RecentState = {
  byShop: Record<string, number[]>
  hydrate: () => void
  track: (shopId: number, productId: number) => void
  recentIds: (shopId: number) => number[]
}

function readStorage(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number[]> = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (!Array.isArray(val)) continue
      const ids = val
        .map((x) => Number.parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (ids.length) out[key] = ids.slice(0, MAX_PER_SHOP)
    }
    return out
  } catch {
    return {}
  }
}

function writeStorage(byShop: Record<string, number[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(byShop))
  } catch {
    /* ignore */
  }
}

export const useStorefrontRecentlyViewedStore = create<RecentState>((set, get) => ({
  byShop: {},

  hydrate: () => set({ byShop: readStorage() }),

  track: (shopId, productId) => {
    const key = String(shopId)
    set((state) => {
      const prev = state.byShop[key] ?? []
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_PER_SHOP)
      const byShop = { ...state.byShop, [key]: next }
      writeStorage(byShop)
      return { byShop }
    })
  },

  recentIds: (shopId) => get().byShop[String(shopId)] ?? EMPTY_RECENT_IDS,
}))
