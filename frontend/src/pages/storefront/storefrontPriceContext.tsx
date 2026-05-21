import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  parseExchangeRate,
  readCurrencyPref,
  writeCurrencyPref,
  type StorefrontCurrencyPref,
} from '../../lib/storefrontPriceDisplay'
import { useStorefrontShop } from './StorefrontShopContext'

type Ctx = {
  currency: StorefrontCurrencyPref
  setCurrency: (c: StorefrontCurrencyPref) => void
  rate: number | null
}

const StorefrontPriceContext = createContext<Ctx | null>(null)

export function StorefrontPriceProvider({ children }: { children: React.ReactNode }) {
  const { shopId, appearance, exchangeRate } = useStorefrontShop()
  const defaultPref = (appearance.price_display_default ?? 'usd') as 'usd' | 'iqd' | 'both'
  const [currency, setCurrencyState] = useState<StorefrontCurrencyPref>(() =>
    readCurrencyPref(shopId, defaultPref),
  )

  useEffect(() => {
    setCurrencyState(readCurrencyPref(shopId, defaultPref))
  }, [shopId, defaultPref])

  const setCurrency = useCallback(
    (c: StorefrontCurrencyPref) => {
      setCurrencyState(c)
      writeCurrencyPref(shopId, c)
    },
    [shopId],
  )

  const rate = useMemo(() => parseExchangeRate(exchangeRate), [exchangeRate])

  const value = useMemo(
    () => ({ currency, setCurrency, rate }),
    [currency, setCurrency, rate],
  )

  return (
    <StorefrontPriceContext.Provider value={value}>{children}</StorefrontPriceContext.Provider>
  )
}

export function useStorefrontPrice() {
  const c = useContext(StorefrontPriceContext)
  if (!c) throw new Error('useStorefrontPrice outside StorefrontPriceProvider')
  return c
}
