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
  logo_url: null,
  accent_color: '#fbbf24',
  banner_rotate_seconds: 5,
  price_display_default: 'usd',
  contact_phone: '',
  contact_whatsapp: '',
  contact_email: '',
  about_title: '',
  about_body: '',
  faq_items: [],
  shop_address: '',
  location_url: '',
  location_image_url: null,
  social_links: [],
}

type Ctx = {
  shopId: number | null
  shopName: string
  appearance: PublicStorefrontAppearance
  exchangeRate: string | null
  loading: boolean
  error: string | null
  reload: () => void
  mergeAppearance: (patch: Partial<PublicStorefrontAppearance>) => void
  setExchangeRate: (raw: string | null | undefined) => void
}

const StorefrontShopContext = createContext<Ctx | null>(null)

export function StorefrontShopProvider({ children }: { children: React.ReactNode }) {
  const [shopId, setShopId] = useState<number | null>(null)
  const [shopName, setShopName] = useState('')
  const [appearance, setAppearance] = useState<PublicStorefrontAppearance>(DEFAULT_APPEARANCE)
  const [exchangeRate, setExchangeRateState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mergeAppearance = useCallback((patch: Partial<PublicStorefrontAppearance>) => {
    setAppearance((prev) => ({ ...prev, ...patch }))
  }, [])

  const setExchangeRate = useCallback((raw: string | null | undefined) => {
    setExchangeRateState(raw != null && String(raw).trim() !== '' ? String(raw) : null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const row = await resolvePublicStorefront()
      setShopId(row.shop_id)
      setShopName(row.storefront?.catalog_title || row.name)
      setAppearance(row.storefront ?? { ...DEFAULT_APPEARANCE, catalog_title: row.name })
      setExchangeRateState(row.exchange_rate_usd_to_iqd ?? null)
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
    () => ({
      shopId,
      shopName,
      appearance,
      exchangeRate,
      loading,
      error,
      reload: load,
      mergeAppearance,
      setExchangeRate,
    }),
    [shopId, shopName, appearance, exchangeRate, loading, error, load, mergeAppearance, setExchangeRate],
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
