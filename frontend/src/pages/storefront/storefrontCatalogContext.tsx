import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type { PublicStorefrontProduct } from '../../api/storefrontApi'

export type StorefrontView = 'categories' | 'products' | 'product'

type Ctx = {
  view: StorefrontView
  selectedCategoryId: number | null
  selectedProduct: PublicStorefrontProduct | null
  productCategoryName: string
  selectCategory: (id: number) => void
  showAllProducts: () => void
  backToCategories: () => void
  openProduct: (product: PublicStorefrontProduct, categoryName?: string) => void
  backFromProduct: () => void
  setSearchActive: (active: boolean) => void
}

const StorefrontCatalogContext = createContext<Ctx | null>(null)

function scrollMainTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' })
}

export function StorefrontCatalogProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<StorefrontView>('categories')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<PublicStorefrontProduct | null>(null)
  const [productCategoryName, setProductCategoryName] = useState('')
  const [returnView, setReturnView] = useState<'categories' | 'products'>('products')

  const selectCategory = useCallback((id: number) => {
    setSelectedCategoryId(id)
    setView('products')
    scrollMainTop()
  }, [])

  const showAllProducts = useCallback(() => {
    setSelectedCategoryId(null)
    setView('products')
    scrollMainTop()
  }, [])

  const backToCategories = useCallback(() => {
    setSelectedCategoryId(null)
    setSelectedProduct(null)
    setView('categories')
    document.documentElement.style.overflow = ''
    scrollMainTop()
  }, [])

  const openProduct = useCallback(
    (product: PublicStorefrontProduct, categoryName = '') => {
      setReturnView(view === 'categories' ? 'products' : 'products')
      setSelectedProduct(product)
      setProductCategoryName(categoryName)
      setView('product')
      document.documentElement.style.overflow = 'hidden'
      scrollMainTop(false)
    },
    [view],
  )

  const backFromProduct = useCallback(() => {
    setSelectedProduct(null)
    setView(returnView)
    document.documentElement.style.overflow = ''
    scrollMainTop(false)
  }, [returnView])

  const setSearchActive = useCallback((active: boolean) => {
    if (active) setView('products')
  }, [])

  const value = useMemo(
    () => ({
      view,
      selectedCategoryId,
      selectedProduct,
      productCategoryName,
      selectCategory,
      showAllProducts,
      backToCategories,
      openProduct,
      backFromProduct,
      setSearchActive,
    }),
    [
      view,
      selectedCategoryId,
      selectedProduct,
      productCategoryName,
      selectCategory,
      showAllProducts,
      backToCategories,
      openProduct,
      backFromProduct,
      setSearchActive,
    ],
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
