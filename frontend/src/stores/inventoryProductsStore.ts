import { create } from 'zustand'

import type { ProductRow } from '../types/api'

type State = {
  items: ProductRow[]
  setItems: (items: ProductRow[]) => void
  reset: () => void
}

/**
 * List data for Inventory only — subscribe with a selector so unrelated UI
 * (header, modals) does not re-render when products update.
 */
export const useInventoryProductsStore = create<State>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  reset: () => set({ items: [] }),
}))
