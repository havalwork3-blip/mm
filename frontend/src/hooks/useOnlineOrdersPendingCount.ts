import { useCallback, useEffect, useState } from 'react'

import { fetchMerchantStorefrontPendingCount } from '../lib/merchantStorefrontApi'

/** Poll + events refresh pending online order count for sidebar badge. */
export function useOnlineOrdersPendingCount(enabled: boolean) {
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(0)
      return
    }
    try {
      const row = await fetchMerchantStorefrontPendingCount()
      setCount(Math.max(0, Number(row.pending_count) || 0))
    } catch {
      setCount(0)
    }
  }, [enabled])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => void refresh(), 60_000)
    const onRefresh = () => void refresh()
    window.addEventListener('mm-online-orders-changed', onRefresh)
    window.addEventListener('mm-dashboard-refresh', onRefresh)
    window.addEventListener('mm-session-refresh', onRefresh)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('mm-online-orders-changed', onRefresh)
      window.removeEventListener('mm-dashboard-refresh', onRefresh)
      window.removeEventListener('mm-session-refresh', onRefresh)
    }
  }, [refresh])

  return count
}

export function notifyOnlineOrdersChanged() {
  window.dispatchEvent(new Event('mm-online-orders-changed'))
}
