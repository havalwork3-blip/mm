import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  apiJson,
  clearSessionAuth,
  isApiStatus,
  persistSessionAuth,
  restoreSessionAuth,
  setBasicAuth,
  setSuperuserShopId,
} from '../lib/api'
import type { Me } from '../types/api'

type SessionCtx = {
  me: Me | null
  /** True until first /api/users/me/ attempt finishes */
  loading: boolean
  refresh: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<SessionCtx | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  const applyProfile = useCallback((profile: Me) => {
    setMe(profile)
    if (profile.is_superuser) {
      const stored = localStorage.getItem('pos_shop_id')
      if (stored) setSuperuserShopId(stored)
      else setSuperuserShopId(null)
    } else {
      localStorage.removeItem('pos_shop_id')
      setSuperuserShopId(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!restoreSessionAuth()) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const profile = await apiJson<Me>('/api/users/me/', { shopScoped: true })
      applyProfile(profile)
    } catch (e) {
      if (isApiStatus(e, 401)) {
        setMe(null)
        clearSessionAuth()
        setBasicAuth(null, null)
        setSuperuserShopId(null)
      }
    } finally {
      setLoading(false)
    }
  }, [applyProfile])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onFocus = () => {
      // Session is already loaded after sign-in; skip redundant /me on every tab focus.
      if (me) return
      void refresh()
    }
    const onSessionRefresh = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('mm-session-refresh', onSessionRefresh)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('mm-session-refresh', onSessionRefresh)
    }
  }, [refresh, me])

  const login = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = email.trim()
      setBasicAuth(normalizedEmail, password)
      persistSessionAuth(normalizedEmail, password)
      try {
        const profile = await apiJson<Me>('/api/users/me/', { shopScoped: true })
        applyProfile(profile)
      } catch (e) {
        if (isApiStatus(e, 401)) {
          setMe(null)
          clearSessionAuth()
          setBasicAuth(null, null)
          setSuperuserShopId(null)
        }
        throw e
      } finally {
        setLoading(false)
      }
    },
    [applyProfile],
  )

  const logout = useCallback(() => {
    setMe(null)
    setBasicAuth(null, null)
    clearSessionAuth()
    setSuperuserShopId(null)
  }, [])

  const value = useMemo(
    () => ({ me, loading, refresh, login, logout }),
    [me, loading, refresh, login, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSession outside SessionProvider')
  return c
}
