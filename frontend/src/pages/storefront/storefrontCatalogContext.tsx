import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import type {
  PublicStorefrontCategory,
  PublicStorefrontProduct,
  StorefrontProductCollection,
} from '../../api/storefrontApi'

export type StorefrontView = 'categories' | 'products' | 'product'

type Ctx = {
  view: StorefrontView
  selectedCategoryId: number | null
  productCollection: StorefrontProductCollection | null
  selectedProduct: PublicStorefrontProduct | null
  productCategoryName: string
  search: string
  searchOpen: boolean
  setSearch: (value: string) => void
  openSearch: () => void
  closeSearch: () => void
  selectCategory: (id: number) => void
  showAllProducts: () => void
  showCollection: (collection: StorefrontProductCollection) => void
  backToCategories: () => void
  openProduct: (product: PublicStorefrontProduct, categoryName?: string) => void
  backFromProduct: () => void
  setSearchActive: (active: boolean) => void
  catalogCategories: PublicStorefrontCategory[]
  setCatalogCategories: (rows: PublicStorefrontCategory[]) => void
}

const StorefrontCatalogContext = createContext<Ctx | null>(null)

function scrollMainTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'instant' })
}

export function StorefrontCatalogProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<StorefrontView>('categories')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [productCollection, setProductCollection] = useState<StorefrontProductCollection | null>(
    null,
  )
  const [selectedProduct, setSelectedProduct] = useState<PublicStorefrontProduct | null>(null)
  const [productCategoryName, setProductCategoryName] = useState('')
  const [returnView, setReturnView] = useState<'categories' | 'products'>('products')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [catalogCategories, setCatalogCategories] = useState<PublicStorefrontCategory[]>([])

  const selectCategory = useCallback((id: number) => {
    setSelectedCategoryId(id)
    setProductCollection(null)
    setView('products')
    scrollMainTop()
  }, [])

  const showAllProducts = useCallback(() => {
    setSelectedCategoryId(null)
    setProductCollection(null)
    setView('products')
    scrollMainTop()
  }, [])

  const showCollection = useCallback((collection: StorefrontProductCollection) => {
    setSelectedCategoryId(null)
    setProductCollection(collection)
    setView('products')
    scrollMainTop()
  }, [])

  const backToCategories = useCallback(() => {
    setSelectedCategoryId(null)
    setProductCollection(null)
    setSelectedProduct(null)
    setSearch('')
    setSearchOpen(false)
    setView('categories')
    document.documentElement.style.overflow = ''
    scrollMainTop()
  }, [])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchOpen(false)
  }, [])

  const openProduct = useCallback(
    (product: PublicStorefrontProduct, categoryName = '') => {
      setSearchOpen(false)
      setReturnView(view)
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
      productCollection,
      selectedProduct,
      productCategoryName,
      search,
      searchOpen,
      setSearch,
      openSearch,
      closeSearch,
      selectCategory,
      showAllProducts,
      showCollection,
      backToCategories,
      openProduct,
      backFromProduct,
      setSearchActive,
      catalogCategories,
      setCatalogCategories,
    }),
    [
      view,
      selectedCategoryId,
      productCollection,
      selectedProduct,
      productCategoryName,
      search,
      searchOpen,
      selectCategory,
      showAllProducts,
      showCollection,
      backToCategories,
      openProduct,
      backFromProduct,
      setSearchActive,
      catalogCategories,
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
