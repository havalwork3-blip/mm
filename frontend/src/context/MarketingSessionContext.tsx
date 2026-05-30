import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchMarketingMe, isMarketingAuthError, persistMarketingToken, restoreMarketingToken } from '../lib/marketingApi'
import type { MarketingEditorProfile } from '../lib/marketingApi'

type MarketingSessionCtx = {
  editor: MarketingEditorProfile | null
  loading: boolean
  refresh: () => Promise<void>
  logoutLocal: () => void
}

const Ctx = createContext<MarketingSessionCtx | null>(null)

export function MarketingSessionProvider({ children }: { children: React.ReactNode }) {
  const [editor, setEditor] = useState<MarketingEditorProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const logoutLocal = useCallback(() => {
    setEditor(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!restoreMarketingToken()) {
      setEditor(null)
      setLoading(false)
      return
    }
    try {
      const profile = await fetchMarketingMe()
      setEditor(profile)
    } catch (e) {
      if (isMarketingAuthError(e)) {
        persistMarketingToken(null)
        setEditor(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ editor, loading, refresh, logoutLocal }),
    [editor, loading, refresh, logoutLocal],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMarketingSession() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMarketingSession outside provider')
  return ctx
}

export function useMarketingSessionOptional() {
  return useContext(Ctx)
}
