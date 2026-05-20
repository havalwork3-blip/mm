import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { resolvePublicStorefront } from '../../api/storefrontApi'

type Ctx = {
  shopId: number | null
  shopName: string
  loading: boolean
  error: string | null
  reload: () => void
}

const StorefrontShopContext = createContext<Ctx | null>(null)

export function StorefrontShopProvider({ children }: { children: React.ReactNode }) {
  const [shopId, setShopId] = useState<number | null>(null)
  const [shopName, setShopName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await resolvePublicStorefront()
      setShopId(row.shop_id)
      setShopName(row.name)
    } catch (e) {
      setShopId(null)
      setShopName('')
      setError(e instanceof Error ? e.message : 'Could not load storefront.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo(
    () => ({ shopId, shopName, loading, error, reload: load }),
    [shopId, shopName, loading, error, load],
  )

  return (
    <StorefrontShopContext.Provider value={value}>
      {children}
    </StorefrontShopContext.Provider>
  )
}

export function useStorefrontShop() {
  const c = useContext(StorefrontShopContext)
  if (!c) throw new Error('useStorefrontShop outside StorefrontShopProvider')
  return c
}
