import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiJson, restoreSessionAuth, setSuperuserShopId } from '../lib/api'
import type { ShopRow, ShopSettingsRow } from '../types/api'

type ThemeCtx = {
  primaryColor: string
  backgroundColor: string
  applyTheme: (next: { primaryColor: string; backgroundColor?: string }) => void
}

const STORAGE_KEY = 'mm-theme-settings'
const DEFAULT_PRIMARY = '#7c3aed'
const DEFAULT_BACKGROUND = '#f1f5f9'

const Ctx = createContext<ThemeCtx | null>(null)

function applyRootTheme(primaryColor: string, backgroundColor: string) {
  const root = document.documentElement
  root.style.setProperty('--primary-color', primaryColor)
  root.style.setProperty('--color-violet-500', primaryColor)
  root.style.setProperty('--color-violet-600', primaryColor)
  root.style.setProperty('--color-violet-700', primaryColor)
  root.style.setProperty('--app-bg-color', backgroundColor)
  root.classList.remove('dark')
  root.style.colorScheme = 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        primaryColor?: string
        backgroundColor?: string
      }
      if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor)
      if (parsed.backgroundColor) setBackgroundColor(parsed.backgroundColor)
    } catch {
      // Ignore local preference parsing errors.
    }
  }, [])

  useEffect(() => {
    applyRootTheme(primaryColor, backgroundColor)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor, backgroundColor }))
    } catch {
      // Ignore persistence failures.
    }
  }, [primaryColor, backgroundColor])

  useEffect(() => {
    const loadFromApi = async () => {
      if (!restoreSessionAuth()) return
      try {
        const me = await apiJson<{ is_superuser: boolean; shop: number | null }>('/api/users/me/')
        if (me.is_superuser || me.shop !== null) {
          const shops = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/')
          const list = Array.isArray(shops) ? shops : shops.results
          if (!list[0]) return
          if (me.is_superuser) {
            const scoped = localStorage.getItem('pos_shop_id')?.trim()
            if (!scoped) {
              const fallback = String(list[0].id)
              localStorage.setItem('pos_shop_id', fallback)
              setSuperuserShopId(fallback)
            }
          }
          const settings = await apiJson<ShopSettingsRow>('/api/shop-settings/')
          if (settings.primary_color) setPrimaryColor(settings.primary_color)
        }
      } catch {
        // Fail silently; local theme remains active.
      }
    }
    void loadFromApi()
  }, [])

  const value = useMemo(
    () => ({
      primaryColor,
      backgroundColor,
      applyTheme: (next: { primaryColor: string; backgroundColor?: string }) => {
        setPrimaryColor(next.primaryColor)
        if (next.backgroundColor) setBackgroundColor(next.backgroundColor)
      },
    }),
    [primaryColor, backgroundColor],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
