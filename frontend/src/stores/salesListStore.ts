import { create } from 'zustand'

import type { SaleListRow } from '../types/api'

type State = {
  items: SaleListRow[]
  setItems: (items: SaleListRow[]) => void
  reset: () => void
}

/** Sales history for /sales — isolated store to limit re-renders. */
export const useSalesListStore = create<State>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  reset: () => set({ items: [] }),
}))
