import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type StorefrontView = 'categories' | 'products'

type Ctx = {
  view: StorefrontView
  selectedCategoryId: number | null
  selectCategory: (id: number) => void
  showAllProducts: () => void
  backToCategories: () => void
  setSearchActive: (active: boolean) => void
}

const StorefrontCatalogContext = createContext<Ctx | null>(null)

export function StorefrontCatalogProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<StorefrontView>('categories')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  const selectCategory = useCallback((id: number) => {
    setSelectedCategoryId(id)
    setView('products')
    window.setTimeout(() => {
      document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [])

  const showAllProducts = useCallback(() => {
    setSelectedCategoryId(null)
    setView('products')
    window.setTimeout(() => {
      document.getElementById('sf-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [])

  const backToCategories = useCallback(() => {
    setSelectedCategoryId(null)
    setView('categories')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const setSearchActive = useCallback((active: boolean) => {
    if (active) setView('products')
  }, [])

  const value = useMemo(
    () => ({
      view,
      selectedCategoryId,
      selectCategory,
      showAllProducts,
      backToCategories,
      setSearchActive,
    }),
    [view, selectedCategoryId, selectCategory, showAllProducts, backToCategories, setSearchActive],
  )

  return (
    <StorefrontCatalogContext.Provider value={value}>{children}</StorefrontCatalogContext.Provider>
  )
}

export function useStorefrontCatalog() {
  const c = useContext(StorefrontCatalogContext)
  if (!c) throw new Error('useStorefrontCatalog outside StorefrontCatalogProvider')
  return c
}
