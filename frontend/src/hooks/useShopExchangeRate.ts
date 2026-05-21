import { useCallback, useEffect, useState } from 'react'

import { apiJson } from '../lib/api'
import type { CurrencyRow } from '../types/api'

export function useShopExchangeRate(enabled: boolean) {
  const [rate, setRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    try {
      const rows = await apiJson<CurrencyRow[] | { results: CurrencyRow[] }>(
        '/api/currencies/',
        { shopScoped: true },
      )
      const list = Array.isArray(rows) ? rows : rows.results ?? []
      const sorted = [...list].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
      const latest = sorted[0]
      if (latest?.usd_to_iqd != null) {
        const n = parseFloat(String(latest.usd_to_iqd))
        setRate(Number.isFinite(n) && n > 0 ? n : null)
      } else {
        setRate(null)
      }
    } catch {
      setRate(null)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  return { rate, loading, reload: load }
}
