import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  resolvePublicStorefront,
  type PublicStorefrontAppearance,
} from '../../api/storefrontApi'

const DEFAULT_APPEARANCE: PublicStorefrontAppearance = {
  catalog_title: '',
  catalog_subtitle: '',
  welcome_message: '',
  accent_color: '#fbbf24',
  banner_rotate_seconds: 5,
}

type Ctx = {
  shopId: number | null
  shopName: string
  appearance: PublicStorefrontAppearance
  loading: boolean
  error: string | null
  reload: () => void
}

const StorefrontShopContext = createContext<Ctx | null>(null)

export function StorefrontShopProvider({ children }: { children: React.ReactNode }) {
  const [shopId, setShopId] = useState<number | null>(null)
  const [shopName, setShopName] = useState('')
  const [appearance, setAppearance] = useState<PublicStorefrontAppearance>(DEFAULT_APPEARANCE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await resolvePublicStorefront()
      setShopId(row.shop_id)
      setShopName(row.storefront?.catalog_title || row.name)
      setAppearance(row.storefront ?? { ...DEFAULT_APPEARANCE, catalog_title: row.name })
    } catch (e) {
      setShopId(null)
      setShopName('')
      setAppearance(DEFAULT_APPEARANCE)
      setError(e instanceof Error ? e.message : 'Could not load storefront.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo(
    () => ({ shopId, shopName, appearance, loading, error, reload: load }),
    [shopId, shopName, appearance, loading, error, load],
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
