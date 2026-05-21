import { create } from 'zustand'

const STORAGE_KEY = 'sf_favorites_v1'

/** Stable empty list — avoids infinite re-renders when used in Zustand selectors. */
export const EMPTY_FAVORITE_IDS: number[] = []

type FavoritesState = {
  byShop: Record<string, number[]>
  hydrate: () => void
  toggle: (shopId: number, productId: number) => void
  isFavorite: (shopId: number, productId: number) => boolean
  favoriteIds: (shopId: number) => number[]
  count: (shopId: number) => number
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
      if (ids.length) out[key] = [...new Set(ids)]
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
    /* quota / private mode */
  }
}

function shopKey(shopId: number) {
  return String(shopId)
}

export const useStorefrontFavoritesStore = create<FavoritesState>((set, get) => ({
  byShop: {},

  hydrate: () => {
    set({ byShop: readStorage() })
  },

  toggle: (shopId, productId) => {
    const key = shopKey(shopId)
    set((state) => {
      const prev = state.byShop[key] ?? []
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
      const byShop = { ...state.byShop, [key]: next }
      writeStorage(byShop)
      return { byShop }
    })
  },

  isFavorite: (shopId, productId) => {
    const ids = get().byShop[shopKey(shopId)] ?? []
    return ids.includes(productId)
  },

  favoriteIds: (shopId) => get().byShop[shopKey(shopId)] ?? EMPTY_FAVORITE_IDS,

  count: (shopId) => (get().byShop[shopKey(shopId)] ?? EMPTY_FAVORITE_IDS).length,
}))
