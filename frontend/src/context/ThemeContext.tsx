import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { apiJson, restoreSessionAuth, setSuperuserShopId } from '../lib/api'
import type { ShopRow, ShopSettingsRow } from '../types/api'

type ThemeMode = 'light' | 'dark' | 'system'

type ThemeCtx = {
  primaryColor: string
  backgroundColor: string
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  applyTheme: (next: { primaryColor: string; backgroundColor?: string; mode?: ThemeMode }) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'mm-theme-settings'
const DEFAULT_PRIMARY = '#7c3aed'
const DEFAULT_MODE: ThemeMode = 'light'
const DEFAULT_BACKGROUND = '#f1f5f9'
/** Main shell background in dark mode (matches POS / slate-900). */
const DEFAULT_DARK_BACKGROUND = '#0f172a'

const Ctx = createContext<ThemeCtx | null>(null)

function applyRootTheme(primaryColor: string, backgroundColor: string, mode: ThemeMode) {
  const root = document.documentElement
  // System-level default is "light"; only the explicit "dark" choice flips the UI to dark.
  // This makes the entire app default to light even when the OS prefers dark.
  const resolvedDark = mode === 'dark'
  root.style.setProperty('--primary-color', primaryColor)
  root.style.setProperty('--color-violet-500', primaryColor)
  root.style.setProperty('--color-violet-600', primaryColor)
  root.style.setProperty('--color-violet-700', primaryColor)
  root.style.setProperty(
    '--app-bg-color',
    resolvedDark ? DEFAULT_DARK_BACKGROUND : backgroundColor,
  )
  root.classList.toggle('dark', resolvedDark)
  root.style.colorScheme = resolvedDark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY)
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_BACKGROUND)
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)
  // "system" now resolves to light too (system-wide light default).
  // OS-level dark preference no longer auto-switches the UI; only an explicit "dark" choice does.
  const resolvedMode: 'light' | 'dark' = mode === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        primaryColor?: string
        backgroundColor?: string
        mode?: ThemeMode
      }
      if (parsed.primaryColor) setPrimaryColor(parsed.primaryColor)
      if (parsed.backgroundColor) setBackgroundColor(parsed.backgroundColor)
      if (parsed.mode) setMode(parsed.mode)
    } catch {
      // Ignore local preference parsing errors.
    }
  }, [])

  useEffect(() => {
    applyRootTheme(primaryColor, backgroundColor, mode)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ primaryColor, backgroundColor, mode }))
    } catch {
      // Ignore persistence failures.
    }
  }, [primaryColor, backgroundColor, mode])

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
          // Only adopt the API mode when it's an explicit choice (light/dark).
          // The legacy "system" default is treated as "light" — see resolvedMode above.
          if (settings.default_mode && settings.default_mode !== 'system') {
            setMode(settings.default_mode)
          }
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
      mode,
      resolvedMode,
      applyTheme: (next: { primaryColor: string; backgroundColor?: string; mode?: ThemeMode }) => {
        setPrimaryColor(next.primaryColor)
        if (next.backgroundColor) setBackgroundColor(next.backgroundColor)
        if (next.mode) setMode(next.mode)
      },
      toggleTheme: () => {
        setMode((m) => (m === 'dark' ? 'light' : 'dark'))
      },
    }),
    [primaryColor, backgroundColor, mode, resolvedMode],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
