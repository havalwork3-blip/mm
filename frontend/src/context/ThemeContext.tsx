import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useSession } from './SessionContext'
import { reconcilePosShopId } from '../lib/activeShop'
import { apiJson, restoreSessionAuth } from '../lib/api'
import {
  THEME_PALETTE_DEFAULTS,
  applyThemePalette,
  paletteFromShopSettings,
  type ThemePalette,
} from '../lib/themeColors'
import type { ShopRow, ShopSettingsRow } from '../types/api'

type ThemeMode = 'light' | 'dark' | 'system'

type ThemeCtx = {
  palette: ThemePalette
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  applyTheme: (next: Partial<ThemePalette> & { mode?: ThemeMode }) => void
  setPaletteFromShopSettings: (settings: ShopSettingsRow) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'mm-theme-settings'
const DEFAULT_MODE: ThemeMode = 'light'

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { me, loading: sessionLoading } = useSession()
  const [palette, setPalette] = useState<ThemePalette>(THEME_PALETTE_DEFAULTS)
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)
  const resolvedMode: 'light' | 'dark' = mode === 'dark' ? 'dark' : 'light'

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        palette?: Partial<ThemePalette>
        primaryColor?: string
        backgroundColor?: string
        mode?: ThemeMode
      }
      if (parsed.palette) {
        setPalette((p) => ({ ...p, ...parsed.palette }))
      } else if (parsed.primaryColor || parsed.backgroundColor) {
        setPalette((p) => ({
          ...p,
          ...(parsed.primaryColor ? { primaryColor: parsed.primaryColor } : {}),
          ...(parsed.backgroundColor ? { backgroundColor: parsed.backgroundColor } : {}),
        }))
      }
      if (parsed.mode) setMode(parsed.mode)
    } catch {
      // Ignore local preference parsing errors.
    }
  }, [])

  useEffect(() => {
    applyThemePalette(palette, resolvedMode)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, mode }))
    } catch {
      // Ignore persistence failures.
    }
  }, [palette, mode, resolvedMode])

  useEffect(() => {
    const loadFromApi = async () => {
      if (sessionLoading || !me) return
      if (!restoreSessionAuth()) return
      try {
        if (me.is_superuser) {
          const shops = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/', {
            omitShopScope: true,
          })
          const list = Array.isArray(shops) ? shops : shops.results
          if (!reconcilePosShopId(list)) return
        } else if (me.shop === null) {
          return
        }

        const settings = await apiJson<ShopSettingsRow>('/api/shop-settings/', {
          shopScoped: me.is_superuser,
        })
        setPalette(paletteFromShopSettings(settings))
        if (settings.default_mode && settings.default_mode !== 'system') {
          setMode(settings.default_mode)
        }
      } catch {
        // Fail silently; local theme remains active.
      }
    }
    const deferId = window.setTimeout(() => {
      void loadFromApi()
    }, 120)
    return () => window.clearTimeout(deferId)
  }, [me, sessionLoading])

  const value = useMemo(
    () => ({
      palette,
      mode,
      resolvedMode,
      applyTheme: (next: Partial<ThemePalette> & { mode?: ThemeMode }) => {
        setPalette((p) => ({ ...p, ...next }))
        if (next.mode) setMode(next.mode)
      },
      setPaletteFromShopSettings: (settings: ShopSettingsRow) => {
        setPalette(paletteFromShopSettings(settings))
        if (settings.default_mode && settings.default_mode !== 'system') {
          setMode(settings.default_mode)
        }
      },
      toggleTheme: () => {
        setMode((m) => (m === 'dark' ? 'light' : 'dark'))
      },
    }),
    [palette, mode, resolvedMode],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

/** @deprecated use `palette.primaryColor` */
export function useThemeLegacyColors() {
  const { palette, mode, resolvedMode, applyTheme, toggleTheme } = useTheme()
  return {
    primaryColor: palette.primaryColor,
    backgroundColor: palette.backgroundColor,
    mode,
    resolvedMode,
    applyTheme: (next: {
      primaryColor: string
      backgroundColor?: string
      mode?: ThemeMode
    }) => {
      applyTheme({
        primaryColor: next.primaryColor,
        ...(next.backgroundColor ? { backgroundColor: next.backgroundColor } : {}),
        ...(next.mode ? { mode: next.mode } : {}),
      })
    },
    toggleTheme,
  }
}
