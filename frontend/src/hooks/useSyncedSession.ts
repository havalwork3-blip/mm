import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context/SessionContext'
import { hasPersistedSessionAuth, setSuperuserShopId } from '../lib/api'
import { useResyncLocalMe } from './useResyncLocalMe'

/**
 * Use global SessionContext instead of per-page `/api/users/me/` on mount.
 * Avoids a flash of the sign-in form while the shared session is already loaded.
 */
export function useSyncedSession() {
  const { me, loading, login, refresh } = useSession()
  const [shopImpersonation, setShopImpersonationState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('pos_shop_id')?.trim() || null
  })

  useEffect(() => {
    if (!me) {
      setShopImpersonationState(null)
      return
    }
    if (me.is_superuser) {
      const stored = localStorage.getItem('pos_shop_id')?.trim()
      if (stored) {
        setShopImpersonationState(stored)
        setSuperuserShopId(stored)
      } else {
        setShopImpersonationState(null)
        setSuperuserShopId(null)
      }
    } else {
      localStorage.removeItem('pos_shop_id')
      setShopImpersonationState(null)
      setSuperuserShopId(null)
    }
  }, [me])

  const setShopImpersonation = useCallback((next: string | null) => {
    const v = next?.trim() || null
    setShopImpersonationState(v)
    if (v) {
      localStorage.setItem('pos_shop_id', v)
      setSuperuserShopId(v)
    } else {
      localStorage.removeItem('pos_shop_id')
      setSuperuserShopId(null)
    }
  }, [])

  useResyncLocalMe(refresh)

  const authPending = loading || (hasPersistedSessionAuth() && !me)
  const showLogin = !authPending && !me
  const canAccessShopData = Boolean(
    me && (!me.is_superuser || me.shop !== null || Boolean(shopImpersonation)),
  )
  const needsShop = Boolean(me?.is_superuser && me.shop === null && !shopImpersonation)

  return {
    me,
    authPending,
    showLogin,
    login,
    refresh,
    shopImpersonation,
    setShopImpersonation,
    canAccessShopData,
    needsShop,
  }
}
