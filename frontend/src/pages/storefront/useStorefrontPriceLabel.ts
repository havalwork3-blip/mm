import { useMemo } from 'react'

import { formatStorefrontPrice } from '../../lib/storefrontPriceDisplay'
import { useStorefrontPrice } from './storefrontPriceContext'
import { storefrontStrings } from './storefrontStrings'
import type { Lang } from '../../i18n/strings'

export function useStorefrontPriceLabel(lang: Lang) {
  const { currency, rate } = useStorefrontPrice()
  const s = storefrontStrings(lang)
  const labels = useMemo(() => ({ usd: s.usd, iqd: s.iqd }), [s.usd, s.iqd])

  return useMemo(
    () => ({
      currency,
      rate,
      format: (usdAmount: number) => formatStorefrontPrice(usdAmount, currency, rate, labels),
      labels,
    }),
    [currency, rate, labels],
  )
}
