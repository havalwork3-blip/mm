import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMerchantStorefrontOrders } from '../lib/merchantStorefrontApi'
import { playOnlineOrderSound, unlockAudioForNotifications } from '../lib/onlineOrderSound'
import { apiJson } from '../lib/api'
import type { ShopSettingsRow } from '../types/api'

export type OnlineOrderToast = {
  id: number
  customerName: string
  total: string
  createdAt: string
}

const POLL_MS = 18_000
const STORAGE_PREFIX = 'mm_storefront_orders_seen_'

function seenKey(shopId: number): string {
  return `${STORAGE_PREFIX}${shopId}`
}

function readLastSeen(shopId: number): number {
  try {
    const raw = sessionStorage.getItem(seenKey(shopId))
    const n = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeLastSeen(shopId: number, id: number): void {
  try {
    sessionStorage.setItem(seenKey(shopId), String(id))
  } catch {
    /* ignore */
  }
}

type Options = {
  enabled: boolean
  shopId: number | null
  soundEnabled: boolean
}

export function useOnlineOrderNotifications({ enabled, shopId, soundEnabled }: Options) {
  const [toasts, setToasts] = useState<OnlineOrderToast[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const initializedRef = useRef(false)
  const lastSeenRef = useRef(0)

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const poll = useCallback(async () => {
    if (!enabled || shopId == null) return
    try {
      const orders = await fetchMerchantStorefrontOrders()
      const pending = orders.filter((o) => o.status === 'PENDING').length
      setPendingCount(pending)

      const maxId = orders.reduce((m, o) => Math.max(m, o.id), 0)
      if (!initializedRef.current) {
        initializedRef.current = true
        const stored = readLastSeen(shopId)
        lastSeenRef.current = Math.max(stored, maxId)
        writeLastSeen(shopId, lastSeenRef.current)
        return
      }

      const fresh = orders
        .filter((o) => o.id > lastSeenRef.current)
        .sort((a, b) => a.id - b.id)

      if (fresh.length === 0) return

      lastSeenRef.current = Math.max(lastSeenRef.current, ...fresh.map((o) => o.id))
      writeLastSeen(shopId, lastSeenRef.current)

      if (soundEnabled) playOnlineOrderSound()

      setToasts((prev) => {
        const next = [...prev]
        for (const o of fresh) {
          next.push({
            id: o.id,
            customerName: o.customer_name,
            total: o.total_amount,
            createdAt: o.created_at,
          })
        }
        return next.slice(-5)
      })
    } catch {
      /* silent — next poll */
    }
  }, [enabled, shopId, soundEnabled])

  useEffect(() => {
    if (!enabled || shopId == null) {
      initializedRef.current = false
      lastSeenRef.current = 0
      setPendingCount(0)
      return
    }
    lastSeenRef.current = readLastSeen(shopId)
    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, shopId, poll])

  useEffect(() => {
    if (!enabled) return
    const unlock = () => unlockAudioForNotifications()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [enabled])

  return { toasts, dismissToast, pendingCount, refreshNow: poll }
}

export async function fetchOnlineOrderSoundEnabled(): Promise<boolean> {
  try {
    const ss = await apiJson<ShopSettingsRow>('/api/shop-settings/', { shopScoped: true })
    return ss.online_order_sound_enabled !== false
  } catch {
    return true
  }
}
